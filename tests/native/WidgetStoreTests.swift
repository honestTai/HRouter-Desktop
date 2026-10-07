import Foundation

// Compiled with the production source; WIDGET_TESTING only swaps the entry point.
@main
struct WidgetStoreTests {
    static func main() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let now = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: Date())!
        let at = now.timeIntervalSince1970
        func write(_ name: String, _ object: [String: Any]) throws {
            try JSONSerialization.data(withJSONObject: object).write(to: directory.appendingPathComponent(name))
        }
        func summary(_ app: String, _ tokens: Int, _ time: Double) -> [String: Any] {
            ["app": app, "providerId": "p", "revision": "r", "tokens": tokens,
             "cacheRate": 0.5, "speed": 50, "speedMeasuredAt": time - 600, "updatedAt": time]
        }
        try write("selected-agent.json", ["app": "claude-desktop"])
        try write("agent-summary-claude-desktop.json", summary("claude-desktop", 100, at))
        try write("agent-summary-codex.json", summary("codex", 200, at))
        var finance: [String: Any] = ["app": "codex", "providerId": "p", "revision": "r", "today": 1.25, "tpm": 0, "updatedAt": at]
        try write("agent-finance-codex.json", finance)
        func entry(_ app: String? = nil, _ date: Date = now) -> UsageEntry {
            SummaryStore.entry(app: app, at: date, directory: directory)
        }
        precondition(entry().agent?.app == "claude-desktop", "follow selection must not use last writer")
        precondition(entry("codex").agent?.tokens == 200, "explicit selection must have its own snapshot")
        precondition(entry("codex").finance?.today == 1.25)
        precondition(entry("codex").finance?.tpm == 0, "idle and unavailable TPM differ")
        precondition(entry("codex").agent?.speed == 50, "older measured speed is not zeroed")
        precondition(entry("codex", now.addingTimeInterval(301)).finance == nil, "finance expires after five minutes")
        precondition(entry("gemini").agent == nil, "missing selection must not show another Agent")
        precondition(entry("../codex").agent == nil, "Agent file paths must be allowlisted")
        finance["revision"] = "old"
        try write("agent-finance-codex.json", finance)
        precondition(entry("codex").finance == nil, "old provider credentials must invalidate finance")
        finance["revision"] = "r"
        finance["app"] = "claude"
        try write("agent-finance-codex.json", finance)
        precondition(entry("codex").finance == nil, "cross-Agent finance must be rejected")
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now)!
        precondition(entry("codex", tomorrow).agent == nil, "yesterday is not today's total")
        try write("agent-summary.json", summary("claude", 300, at))
        precondition(entry("claude").agent?.tokens == 300, "same-Agent legacy migration should work")
        precondition(entry("gemini").agent == nil, "legacy snapshot cannot override an explicit selection")
        try Data("broken".utf8).write(to: directory.appendingPathComponent("agent-summary-codex.json"))
        precondition(entry("codex").agent == nil, "corrupt snapshots fail closed")
        try write("agent-summary-codex.json", summary("claude", 999, at))
        precondition(entry("codex").agent == nil, "file payload Agent must match its name")
        try write("agent-summary-codex.json", summary("codex", 200, at))
        finance["app"] = "codex"
        try write("agent-finance-codex.json", finance)
        let timeline = SummaryStore.timeline(app: "codex", at: now, directory: directory)
        precondition(timeline.entries.first?.finance != nil)
        precondition(timeline.entries.last?.agent == nil, "timeline must expire today's total at midnight")
        precondition(timeline.entries.contains { $0.agent != nil && $0.finance == nil }, "timeline must clear stale finance")
        if #available(macOS 14.0, *) {
            precondition(WidgetAgent.allCases.count == 12, "all eleven Agents plus Follow must be configurable")
            precondition(SelectAgentIntent().agent == .follow)
        }
        print("Widget store: native selection, isolation, expiry and migration checks passed")
    }
}
