import type { ActorContext } from "@refactory/contracts/auth";
import { Effect, Layer, Option, Schema, ServiceMap } from "effect";
import { PersistenceDecodeError } from "./backend-errors.ts";
import { SqliteDatabase, StorageError } from "./sqlite.ts";

export const Profile = Schema.Struct({
  createdAt: Schema.String,
  displayName: Schema.String,
  publicKey: Schema.String,
  updatedAt: Schema.String,
});

export type Profile = Schema.Schema.Type<typeof Profile>;

type ProfileRow = {
  readonly created_at: string;
  readonly display_name: string;
  readonly public_key: string;
  readonly updated_at: string;
};

const decodeProfile = Schema.decodeUnknownEffect(Profile);

const mapProfileRow = (row: ProfileRow) =>
  decodeProfile({
    createdAt: row.created_at,
    displayName: row.display_name,
    publicKey: row.public_key,
    updatedAt: row.updated_at,
  }).pipe(
    Effect.mapError(
      (cause) => new PersistenceDecodeError({ cause, entity: "profile" }),
    ),
  );

const decodeStoredProfile = (row: ProfileRow) =>
  mapProfileRow(row).pipe(Effect.map((profile) => Option.some(profile)));

export class ProfileRepository extends ServiceMap.Service<ProfileRepository>()(
  "refactory/ProfileRepository",
  {
    make: Effect.gen(function* () {
      const sqlite = yield* SqliteDatabase;
      const { database } = sqlite;

      const getProfile = Effect.fn("api.profiles.getProfile")(function* (
        publicKey: string,
      ) {
        const row = yield* Effect.try({
          try: () =>
            database
              .query<ProfileRow, [string]>(
                `SELECT public_key, display_name, created_at, updated_at
                 FROM profiles
                 WHERE public_key = ?1`,
              )
              .get(publicKey),
          catch: (cause) =>
            new StorageError({ cause, operation: "profiles.getProfile" }),
        });

        return yield* Option.match(Option.fromNullishOr(row), {
          onNone: () => Effect.succeed(Option.none()),
          onSome: decodeStoredProfile,
        });
      });

      const upsertProfile = Effect.fn("api.profiles.upsertProfile")(function* (
        actor: ActorContext,
        now: string,
      ) {
        yield* Effect.try({
          try: () => {
            database
              .query(
                `INSERT INTO profiles (public_key, display_name, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(public_key) DO UPDATE SET
                   display_name = excluded.display_name,
                   updated_at = excluded.updated_at`,
              )
              .run(actor.publicKey, actor.displayName, now, now);
          },
          catch: (cause) =>
            new StorageError({ cause, operation: "profiles.upsertProfile" }),
        });
      });

      return {
        getProfile,
        upsertProfile,
      };
    }),
  },
) {
  static readonly Live = Layer.effect(
    ProfileRepository,
    ProfileRepository.make,
  );
}
