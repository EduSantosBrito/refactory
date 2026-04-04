import type { ActorContext } from "@refactory/contracts/auth";
import { Effect, Layer, Option, Schema, ServiceMap } from "effect";
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

const decodeProfile = Schema.decodeUnknownSync(Profile);

const mapProfileRow = (row: ProfileRow): Profile =>
  decodeProfile({
    createdAt: row.created_at,
    displayName: row.display_name,
    publicKey: row.public_key,
    updatedAt: row.updated_at,
  });

export class ProfileRepository extends ServiceMap.Service<
  ProfileRepository,
  {
    readonly getProfile: (
      publicKey: string,
    ) => Effect.Effect<Option.Option<Profile>, StorageError, never>;
    readonly upsertProfile: (
      actor: ActorContext,
      now: string,
    ) => Effect.Effect<void, StorageError, never>;
  }
>()("refactory/ProfileRepository") {
  static readonly Live = Layer.effect(
    ProfileRepository,
    Effect.gen(function* () {
      const sqlite = yield* SqliteDatabase;
      const { database } = sqlite;

      const getProfile = Effect.fnUntraced(function* (publicKey: string) {
        const row = yield* Effect.try({
          try: () =>
            database
              .query<ProfileRow, [string]>(
                `SELECT public_key, display_name, created_at, updated_at
                 FROM profiles
                 WHERE public_key = ?1`,
              )
              .get(publicKey),
          catch: (cause) => new StorageError({ cause, operation: "profiles.getProfile" }),
        });

        return row === null ? Option.none() : Option.some(mapProfileRow(row));
      });

      const upsertProfile = Effect.fnUntraced(function* (actor: ActorContext, now: string) {
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
          catch: (cause) => new StorageError({ cause, operation: "profiles.upsertProfile" }),
        });
      });

      return {
        getProfile,
        upsertProfile,
      };
    }),
  );
}
