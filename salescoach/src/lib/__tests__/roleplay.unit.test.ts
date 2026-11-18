import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildProspectSystemPrompt,
  buildVoiceRealtimeSession,
  turnDetectionConfig,
  VOICE_PROSPECT_BEHAVIOR,
} from "../roleplay";
import type { ScenarioPersona } from "../types";

const persona: ScenarioPersona = {
  name: "Riley Chen",
  title: "VP of Operations",
  company: "Northwind Logistics",
  industry: "freight",
  personality: "skeptical and time-pressed",
  painPoints: ["Missed delivery windows"],
  objections: ["We already have a carrier scorecard"],
  budget: "Needs a clear payback before the CFO will look",
  notes: "Burned by a vendor last year",
  attitude: "skeptical",
  interest: "low",
  priorities: ["On-time delivery"],
  offering: "a dispatch tool that flags late loads",
  objective: "Book a working session with the operations lead",
  situation: "A cold call after a late-shipment quarter",
};

const promptInput = {
  persona,
  difficulty: "hard",
  callType: "discovery",
  companyDescription: "Erota helps revenue teams practice live calls",
};

describe("AI role-play prospect instructions", () => {
  it("keeps the scenario and adds the spoken behavior for voice", () => {
    const instructions = buildProspectSystemPrompt(promptInput, "voice");
    assert.ok(instructions.includes(VOICE_PROSPECT_BEHAVIOR));
    assert.ok(instructions.includes("Riley Chen"));
    assert.ok(instructions.includes("skeptical and time-pressed"));
    assert.ok(instructions.includes("Advanced"));
    assert.ok(instructions.includes("a dispatch tool that flags late loads"));
    assert.ok(instructions.includes("Book a working session with the operations lead"));
    assert.ok(instructions.includes("Missed delivery windows"));
    assert.ok(instructions.includes("We already have a carrier scorecard"));
  });

  it("uses the same behavior for text role-play", () => {
    const instructions = buildProspectSystemPrompt(promptInput, "text");
    assert.ok(instructions.includes(VOICE_PROSPECT_BEHAVIOR));
    assert.ok(instructions.includes("Northwind Logistics"));
    assert.equal(instructions.includes("# How you speak"), false);
  });

  it("sends those instructions and existing interruption settings to the voice provider", () => {
    const previous = process.env.OPENAI_REALTIME_EAGERNESS;
    const previousMode = process.env.OPENAI_REALTIME_TURN_DETECTION;
    delete process.env.OPENAI_REALTIME_EAGERNESS;
    delete process.env.OPENAI_REALTIME_TURN_DETECTION;
    try {
      const instructions = buildProspectSystemPrompt(promptInput, "voice");
      const session = buildVoiceRealtimeSession({
        instructions,
        voice: "marin",
        transcriptionPrompt: "Sales call between a salesperson and Riley Chen at Northwind Logistics.",
      });
      assert.equal(session.instructions, instructions);
      assert.equal(session.model, "gpt-realtime");
      assert.equal(session.audio.output.voice, "marin");
      assert.equal(session.audio.input.turn_detection.type, "semantic_vad");
      assert.equal(session.audio.input.turn_detection.interrupt_response, true);
      assert.equal(session.audio.input.turn_detection.eagerness, "medium");
      assert.equal(turnDetectionConfig().interrupt_response, true);
    } finally {
      if (previous === undefined) delete process.env.OPENAI_REALTIME_EAGERNESS;
      else process.env.OPENAI_REALTIME_EAGERNESS = previous;
      if (previousMode === undefined) delete process.env.OPENAI_REALTIME_TURN_DETECTION;
      else process.env.OPENAI_REALTIME_TURN_DETECTION = previousMode;
    }
  });

  it("does not replace the session prompt when the voice call starts or reconnects", () => {
    const client = readFileSync(new URL("../../components/roleplay/voice-session.tsx", import.meta.url), "utf8");
    const route = readFileSync(new URL("../../app/api/roleplay/[id]/voice/token/route.ts", import.meta.url), "utf8");
    assert.equal(client.includes("response:\n"), false);
    assert.match(route, /buildVoiceRealtimeSession\(\{[\s\S]*instructions,/);
    assert.equal(route.includes("calls/"), false);
  });
});
