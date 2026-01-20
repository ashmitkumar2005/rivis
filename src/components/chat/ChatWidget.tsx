"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
    id: string;
    role: "user" | "bot";
    content: string;
}

interface DiscoveryState {
    phase: "discovery" | "handoff_pending" | "escalation_pending" | "completed";
    collectedFields: Record<string, string>;
    currentQuestionIndex: number;
    started: boolean;
    escalationChoice?: "talk_now" | "email_later";
}

const QUESTIONS = [
    { key: "projectType", text: "What type of project are you working on?" },
    { key: "brandName", text: "What is your brand name?" },
    { key: "industry", text: "Which industry is this for?" },
    { key: "budget", text: "What is your estimated budget?" },
    { key: "timeline", text: "What is your timeline?" },
];

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [discoveryState, setDiscoveryState] = useState<DiscoveryState>({
        phase: "discovery",
        collectedFields: {},
        currentQuestionIndex: 0,
        started: false,
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const discoveryStateRef = useRef(discoveryState);

    useEffect(() => {
        discoveryStateRef.current = discoveryState;
    }, [discoveryState]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    useEffect(() => {
        const state = discoveryStateRef.current;
        if (isOpen && !state.started && state.phase === "discovery") {
            const firstQ = QUESTIONS[0];
            const botMessage: Message = {
                id: Date.now().toString(),
                role: "bot",
                content: firstQ.text,
            };
            setMessages((msgs) => [...msgs, botMessage]);
            setDiscoveryState((prev) => ({ ...prev, started: true }));
        }
    }, [isOpen]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const userText = inputValue.trim();

        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: userText,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue("");

        // Process discovery flow
        setTimeout(() => {
            const state = discoveryStateRef.current;

            // If already started and in discovery, save answer and move to next
            if (state.phase === "discovery") {
                const currentQ = QUESTIONS[state.currentQuestionIndex];
                const updatedFields = { ...state.collectedFields, [currentQ.key]: userText };
                const nextIndex = state.currentQuestionIndex + 1;

                if (nextIndex < QUESTIONS.length) {
                    // Ask next question
                    const nextQ = QUESTIONS[nextIndex];
                    const botMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "bot",
                        content: nextQ.text,
                    };
                    setMessages((msgs) => [...msgs, botMessage]);
                    setDiscoveryState((prev) => ({
                        ...prev,
                        collectedFields: updatedFields,
                        currentQuestionIndex: nextIndex,
                    }));
                } else {
                    // Start Email Handoff
                    const botMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "bot",
                        content: "Thanks! I've collected all the details. What’s the best email to reach you?",
                    };
                    setMessages((msgs) => [...msgs, botMessage]);
                    setDiscoveryState((prev) => ({
                        ...prev,
                        collectedFields: updatedFields,
                        currentQuestionIndex: nextIndex,
                        phase: "handoff_pending",
                    }));
                }
            } else if (state.phase === "handoff_pending") {
                // Validate Email
                if (userText.includes("@") && userText.includes(".")) {
                    // Check Office Hours (CET: Mon-Fri, 09:00 - 18:00)
                    const now = new Date();
                    const timeZone = "Europe/Paris";
                    const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
                    const hour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(now), 10);

                    const isOfficeHours = !["Sat", "Sun"].includes(day) && hour >= 9 && hour < 18;

                    let botContent = "Our team is currently offline. We’ll follow up by email as soon as possible.";
                    let nextPhase: DiscoveryState["phase"] = "completed";

                    if (isOfficeHours) {
                        botContent = "Would you like to talk to someone now, or should we follow up later by email?";
                        nextPhase = "escalation_pending";
                    }

                    const botMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "bot",
                        content: botContent,
                    };
                    setMessages((msgs) => [...msgs, botMessage]);
                    setDiscoveryState((prev) => ({
                        ...prev,
                        collectedFields: { ...prev.collectedFields, email: userText },
                        phase: nextPhase,
                    }));
                } else {
                    const botMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "bot",
                        content: "That doesn’t look like a valid email. Could you try again?",
                    };
                    setMessages((msgs) => [...msgs, botMessage]);
                }
            } else if (state.phase === "escalation_pending") {
                // Handle escalation choice
                const lowerText = userText.toLowerCase();
                let choice: "talk_now" | "email_later" | null = null;

                if (["talk", "now", "human", "connect"].some(w => lowerText.includes(w))) {
                    choice = "talk_now";
                } else if (["email", "later", "not now"].some(w => lowerText.includes(w))) {
                    choice = "email_later";
                }

                if (choice) {
                    const botContent = choice === "talk_now"
                        ? "Got it. Connecting you to a human now…"
                        : "No problem. We’ll follow up by email soon.";

                    const botMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "bot",
                        content: botContent,
                    };

                    setMessages((msgs) => [...msgs, botMessage]);
                    setDiscoveryState((prev) => ({
                        ...prev,
                        escalationChoice: choice,
                        phase: "completed"
                    }));
                } else {
                    const botMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: "bot",
                        content: "I didn't quite get that. Would you like to 'talk now' or 'email later'?",
                    };
                    setMessages((msgs) => [...msgs, botMessage]);
                }
            }
        }, 500);
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
            {/* Chat Popup */}
            {isOpen && (
                <div className="mb-4 w-80 h-96 bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* Header */}
                    <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-sm">
                        <h3 className="font-semibold text-sm">Chat</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="hover:bg-slate-800 p-1 rounded transition-colors text-slate-300 hover:text-white"
                        >
                            <span className="sr-only">Close</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.length === 0 && (
                            <div className="text-center text-gray-400 text-xs mt-4">
                                No messages yet. Start a conversation!
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === "user"
                                        ? "bg-blue-600 text-white rounded-br-none"
                                        : "bg-white border border-gray-100 text-gray-800 rounded-bl-none"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-100">
                        <div className="relative">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Type a message..."
                                className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400 text-gray-900"
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim()}
                                className="absolute right-1.5 top-1.5 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                            >
                                <span className="sr-only">Send</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="h-14 w-14 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all duration-200"
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                )}
            </button>
        </div>
    );
}
