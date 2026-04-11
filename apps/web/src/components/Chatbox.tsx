import type { AssetId } from "@refactory/contracts/worlds";
import { useCallback, useEffect, useRef, useState } from "react";
import { getLocalStorageItem, setLocalStorageItem } from "../browserStorage";
import { DEFAULT_ASSET_ID } from "../characterAssets";

type ChatMessage = {
  id: string;
  type: "message" | "action";
  tag: AssetId;
  name: string;
  text: string;
  timestamp: number;
};

const CHARACTER_COLORS: Record<AssetId, string> = {
  "BAR-001": "#ffc000",
  "FLA-002": "#ff0066",
  "FRO-003": "#00e639",
  "RPA-004": "#ff3300",
};

const WAVE_QUIPS = [
  "Waving is not billable. Your hand has been noted.",
  "Social interaction quota: 1 of 1. Please return to work.",
  "Caution: Excessive friendliness may void your asset warranty.",
  "Wave detected. Morale flagged as suspicious.",
  "GeePeeYou does not reimburse wrist strain from unapproved gestures.",
  "That gesture consumed 0.3 seconds of company time.",
  "Friendship attempts are outside your operational scope.",
  "Unapproved non-verbal communication logged. HR has been cc'd.",
];

const NAME_KEY = "refactory.chat.name";
const MAX_MESSAGES = 50;

function getPlayerName(): string {
  const storedName = getLocalStorageItem(NAME_KEY);
  return !storedName || storedName === "Operator" ? "Brito" : storedName;
}

function setPlayerName(name: string) {
  void setLocalStorageItem(NAME_KEY, name);
}

export function Chatbox({ characterTag = DEFAULT_ASSET_ID as AssetId }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageCount = messages.length;

  // Focus input on Enter when chat is open and input isn't focused
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        isOpen &&
        document.activeElement !== inputRef.current &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  useEffect(() => {
    if (messageCount === 0) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  const addMessage = useCallback(
    (partial: Pick<ChatMessage, "type" | "text">) => {
      setMessages((prev) => [
        ...prev.slice(-(MAX_MESSAGES - 1)),
        {
          ...partial,
          id: crypto.randomUUID(),
          tag: characterTag,
          name: getPlayerName(),
          timestamp: Date.now(),
        },
      ]);
    },
    [characterTag],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === "/wave") {
      window.dispatchEvent(new CustomEvent("player-wave"));
      const quip =
        WAVE_QUIPS[Math.floor(Math.random() * WAVE_QUIPS.length)] ??
        "Wave acknowledged.";
      addMessage({ type: "action", text: quip });
    } else if (trimmed.toLowerCase().startsWith("/name ")) {
      const newName = trimmed.slice(6).trim();
      if (newName) {
        setPlayerName(newName);
      }
    } else {
      addMessage({ type: "message", text: trimmed });
      window.dispatchEvent(new CustomEvent("player-chat", { detail: trimmed }));
    }

    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  return (
    <div className="chatbox">
      <button
        type="button"
        className="chatbox-toggle"
        onClick={() => setIsOpen((o) => !o)}
      >
        <span className="chatbox-toggle-arrow">
          {isOpen ? "\u25BE" : "\u25B8"}
        </span>
        <span>Comms</span>
      </button>

      {isOpen && (
        <>
          <div className="chatbox-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <p className="chatbox-empty">
                GeePeeYou Comms Channel active. Type /wave to greet the void.
              </p>
            )}
            {messages.map((msg) => {
              const nameColor =
                CHARACTER_COLORS[msg.tag] || CHARACTER_COLORS[DEFAULT_ASSET_ID];
              return (
                <div
                  key={msg.id}
                  className={`chatbox-msg chatbox-msg-${msg.type}`}
                >
                  {msg.type === "action" ? (
                    <p>
                      <span
                        className="chatbox-name"
                        style={{ color: nameColor }}
                      >
                        {msg.tag} ({msg.name})
                      </span>{" "}
                      <span className="chatbox-wave-verb">waved</span>{" "}
                      <span className="chatbox-quip">&mdash; {msg.text}</span>
                    </p>
                  ) : (
                    <p>
                      <span
                        className="chatbox-name"
                        style={{ color: nameColor }}
                      >
                        {msg.tag} ({msg.name})
                      </span>
                      : {msg.text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <form className="chatbox-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="chatbox-input"
              placeholder="Transmit or /wave ..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={200}
            />
          </form>
        </>
      )}
    </div>
  );
}
