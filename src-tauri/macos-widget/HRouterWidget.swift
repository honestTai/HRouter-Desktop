import AppIntents
import Foundation
import SwiftUI
import WidgetKit

private let appGroupIdentifier = "QA2AVNA553.com.hrouter.desktop"

struct AgentSummary: Decodable {
    let app: String
    let providerId: String?
    let revision: String?
    let tokens: Double
    let cacheRate: Double
    let speed: Double?
    var speedMeasuredAt: TimeInterval? = nil
    let updatedAt: TimeInterval

    var name: String {
        ["claude": "Claude Code", "claude-desktop": "Claude Desktop", "codex": "Codex",
         "gemini": "Gemini", "grokbuild": "Grok Build", "opencode": "OpenCode",
         "openclaw": "OpenClaw", "hermes": "Hermes", "pi": "Pi Agent",
         "deepseek": "DeepSeek Harness", "deepseek-harness": "DeepSeek Harness", "workbuddy": "WorkBuddy"][app] ?? app
    }
}

struct AgentFinance: Decodable {
    let app: String
    let providerId: String?
    let revision: String?
    let today: Double?
    let spent: Double?
    let balance: Double?
    let tpm: Double?
    let unit: String?
    let updatedAt: TimeInterval
}

struct UsageEntry: TimelineEntry {
    let date: Date
    var agent: AgentSummary? = nil
    var finance: AgentFinance? = nil
    var selectedApp: String? = nil
}

enum SummaryStore {
    static func read<T: Decodable>(_ name: String, as type: T.Type, directory: URL? = nil) -> T? {
        let root = directory ?? FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)?
            .appendingPathComponent("Library/Application Support/HRouter")
        guard let root, let data = try? Data(contentsOf: root.appendingPathComponent(name)) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private struct Selection: Decodable { let app: String }
    private static let allowedApps: Set<String> = [
        "claude", "claude-desktop", "codex", "gemini", "grokbuild", "opencode",
        "openclaw", "hermes", "pi", "deepseek-harness", "workbuddy"
    ]

    static func entry(app requestedApp: String? = nil, at now: Date = Date(), directory: URL? = nil) -> UsageEntry {
        // Explicit configurations never fall back to a different Agent's data.
        let selected = requestedApp ?? read("selected-agent.json", as: Selection.self, directory: directory)?.app
        let legacy = read("agent-summary.json", as: AgentSummary.self, directory: directory)
        let app = selected ?? legacy?.app ?? "claude"
        guard allowedApps.contains(app) else { return UsageEntry(date: now) }
        var agent = read("agent-summary-\(app).json", as: AgentSummary.self, directory: directory)
            ?? (legacy?.app == app ? legacy : nil)
        if let value = agent, value.app != app || !Calendar.current.isDate(Date(timeIntervalSince1970: value.updatedAt), inSameDayAs: now) { agent = nil }
        var finance = read("agent-finance-\(app).json", as: AgentFinance.self, directory: directory)
        if let value = finance {
            if value.app != agent?.app || value.providerId != agent?.providerId || value.revision != agent?.revision || now.timeIntervalSince1970 - value.updatedAt > 300 {
                finance = nil
            }
        }
        return UsageEntry(date: now, agent: agent, finance: finance, selectedApp: app)
    }

    static func timeline(app: String? = nil, at now: Date = Date(), directory: URL? = nil) -> Timeline<UsageEntry> {
        let entry = entry(app: app, at: now, directory: directory)
        let midnight = Calendar.current.startOfDay(for: now).addingTimeInterval(24 * 60 * 60)
        // Include expiry entries so stale finance/day totals disappear even when
        // WidgetKit postpones a reload. Calendar arithmetic handles DST days.
        let nextDay = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)) ?? midnight
        var dates = [nextDay]
        if let speedAt = entry.agent?.speedMeasuredAt {
            dates.append(Date(timeIntervalSince1970: speedAt + 301))
        }
        if let finance = entry.finance {
            dates.append(Date(timeIntervalSince1970: finance.updatedAt + 301))
        }
        let entries = [entry] + dates.filter { $0 > now }.sorted().map { self.entry(app: app, at: $0, directory: directory) }
        return Timeline(entries: entries, policy: .after(now.addingTimeInterval(15 * 60)))
    }
}

private struct UsageProvider: TimelineProvider {
    func placeholder(in context: Context) -> UsageEntry {
        UsageEntry(date: Date(), agent: AgentSummary(
            app: "codex", providerId: nil, revision: nil,
            tokens: 12500, cacheRate: 0.65, speed: 42,
            updatedAt: Date().timeIntervalSince1970
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (UsageEntry) -> Void) {
        completion(SummaryStore.entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<UsageEntry>) -> Void) {
        completion(SummaryStore.timeline())
    }
}

@available(macOS 14.0, *)
enum WidgetAgent: String, AppEnum {
    case follow, claude, codex, gemini, grokbuild, opencode, openclaw, hermes, pi, workbuddy
    case claudeDesktop = "claude-desktop"
    case deepseek = "deepseek-harness"
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Agent"
    static var caseDisplayRepresentations: [WidgetAgent: DisplayRepresentation] = [
        .follow: "跟随应用 / Follow app", .claude: "Claude Code", .claudeDesktop: "Claude Desktop",
        .codex: "Codex", .gemini: "Gemini", .grokbuild: "Grok Build", .opencode: "OpenCode",
        .openclaw: "OpenClaw", .hermes: "Hermes", .pi: "Pi Agent",
        .deepseek: "DeepSeek Harness", .workbuddy: "WorkBuddy"
    ]
}

@available(macOS 14.0, *)
struct SelectAgentIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "选择 Agent / Choose Agent"
    static var description = IntentDescription("每个小组件可独立选择 Agent / Each widget can monitor its own Agent.")
    @Parameter(title: "Agent", default: .follow) var agent: WidgetAgent
}

@available(macOS 14.0, *)
private struct ConfigurableUsageProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> UsageEntry { UsageProvider().placeholder(in: context) }
    func snapshot(for configuration: SelectAgentIntent, in context: Context) async -> UsageEntry {
        SummaryStore.entry(app: configuration.agent == .follow ? nil : configuration.agent.rawValue)
    }
    func timeline(for configuration: SelectAgentIntent, in context: Context) async -> Timeline<UsageEntry> {
        SummaryStore.timeline(app: configuration.agent == .follow ? nil : configuration.agent.rawValue)
    }
}

private struct WidgetCopy {
    let updated: String
    let unavailable: String
    let openApp: String

    static var current: WidgetCopy {
        let language = Locale.preferredLanguages.first ?? "en"
        if language.hasPrefix("zh") {
            return WidgetCopy(
                updated: "更新于",
                unavailable: "暂无用量数据",
                openApp: "打开 HRouter 后自动同步"
            )
        }
        return WidgetCopy(
            updated: "Updated",
            unavailable: "No usage data",
            openApp: "Open HRouter to sync"
        )
    }
}

private struct BrandMark: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(Color(red: 0.05, green: 0.10, blue: 0.12))
            Text("H")
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(Color(red: 0.25, green: 0.86, blue: 0.58))
        }
        .frame(width: 26, height: 26)
    }
}

private struct WidgetContent: View {
    @Environment(\.widgetFamily) private var family
    let entry: UsageEntry

    private let copy = WidgetCopy.current

    var body: some View {
        Group {
            if let agent = entry.agent {
                if family == .systemMedium { mediumAgentContent(agent) }
                else { agentContent(agent) }
            } else {
                unavailableContent
            }
        }
        .modifier(HRouterWidgetBackground())
    }

    private var isChinese: Bool { (Locale.preferredLanguages.first ?? "en").hasPrefix("zh") }

    private func mediumAgentContent(_ agent: AgentSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                BrandMark()
                Text(agent.name).font(.subheadline.weight(.semibold))
                Spacer()
                Text(updatedText(agent.updatedAt)).font(.system(size: 9)).foregroundStyle(.secondary)
            }
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(agent.tokens, format: .number.notation(.compactName)).font(.title2.weight(.semibold)).privacySensitive()
                    Text(isChinese ? "今日 Tokens" : "Today's tokens").font(.caption2).foregroundStyle(.secondary)
                    HStack {
                        Text(isChinese ? "缓存命中" : "Cache hit")
                        Spacer()
                        Text(agent.cacheRate, format: .percent.precision(.fractionLength(0)))
                    }.font(.caption2)
                    ProgressView(value: min(1, max(0, agent.cacheRate))).tint(.accentColor)
                }.frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 8) {
                    speedContent(agent)
                    if let finance = entry.finance {
                        HStack(spacing: 8) {
                            if let today = finance.today { metric(isChinese ? "今日花费" : "Today", today, finance.unit) }
                            if let balance = finance.balance { metric(isChinese ? "余额" : "Balance", balance, finance.unit) }
                        }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }.padding(14)
    }

    private func agentContent(_ agent: AgentSummary) -> some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 6 : 10) {
            HStack(spacing: 8) {
                BrandMark()
                Text(agent.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 0)
            }
            Text(agent.tokens, format: .number.notation(.compactName))
                .font(.system(size: 26, weight: .semibold, design: .rounded))
                .privacySensitive()
            Text(isChinese ? "今日 Tokens" : "Today's tokens").font(.caption2).foregroundStyle(.secondary)
            HStack {
                Text(isChinese ? "缓存命中" : "Cache hit")
                Spacer()
                Text(agent.cacheRate, format: .percent.precision(.fractionLength(1)))
            }.font(.caption)
            ProgressView(value: min(1, max(0, agent.cacheRate))).tint(.accentColor)
            if family != .systemSmall {
                speedContent(agent)
                if let finance = entry.finance {
                    Divider()
                    HStack(alignment: .top, spacing: 14) {
                        if let today = finance.today { metric(isChinese ? "今日花费" : "Today's spend", today, finance.unit) }
                        if let balance = finance.balance { metric(isChinese ? "余额" : "Balance", balance, finance.unit) }
                        if family == .systemLarge, let spent = finance.spent { metric(isChinese ? "Key 累计消费" : "Key total spend", spent, finance.unit) }
                    }
                }
            }
            Spacer(minLength: 0)
            Text(updatedText(agent.updatedAt)).font(.system(size: 9)).foregroundStyle(.secondary)
        }
        .padding(14)
    }

    private func speedContent(_ agent: AgentSummary) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            if let speed = agent.speed, speed.isFinite, speed > 0 {
                let last = agent.speedMeasuredAt ?? agent.updatedAt
                let recent = entry.date.timeIntervalSince1970 - last <= 300
                Text("\(isChinese ? (recent ? "生成" : "上次生成") : (recent ? "Generation" : "Last generation")) \(speed, specifier: "%.1f") tok/s")
                    .font(.caption.weight(.semibold))
                if !recent {
                    Text(updatedText(last)).font(.system(size: 9)).foregroundStyle(.secondary)
                }
            } else {
                Text(isChinese ? "生成速度 — 暂无计时" : "Generation — no timing")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            // TPM is a separate server window metric, never a generation-speed fallback.
            if let tpm = entry.finance?.tpm, tpm.isFinite, tpm >= 0 {
                Text(tpm == 0
                     ? (isChinese ? "Key 当前窗口无吞吐" : "Key: idle window")
                     : "Key \(isChinese ? "吞吐" : "throughput") \(String(format: "%.0f", tpm)) tok/min")
                    .font(.system(size: 9)).foregroundStyle(.secondary)
            }
        }
    }

    private func metric(_ label: String, _ amount: Double, _ unit: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text("\(amount, specifier: "%.2f") \(unit ?? "")").font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7).privacySensitive()
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private var unavailableContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            BrandMark()
            Spacer(minLength: 0)
            Text(copy.unavailable)
                .font(.headline)
            Text(copy.openApp)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(16)
    }

    private func updatedText(_ timestamp: TimeInterval) -> String {
        let date = Date(timeIntervalSince1970: timestamp)
        return "\(copy.updated) \(date.formatted(date: .omitted, time: .shortened))"
    }
}

private struct HRouterWidgetBackground: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(macOS 14.0, *) {
            content.containerBackground(for: .widget) {
                Color(nsColor: .windowBackgroundColor)
            }
        } else {
            content.background(Color(nsColor: .windowBackgroundColor))
        }
    }
}

#if !WIDGET_TESTING
@main
#endif
struct HRouterUsageWidget: Widget {
    private let kind = "com.hrouter.desktop.widget.usage"

    var body: some WidgetConfiguration {
        if #available(macOS 14.0, *) {
            return AppIntentConfiguration(kind: kind, intent: SelectAgentIntent.self, provider: ConfigurableUsageProvider()) { entry in
                WidgetContent(entry: entry)
            }
            .configurationDisplayName("HRouter 用量")
            .description("右键编辑小组件可选择 Agent / Edit Widget to choose an Agent.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        } else {
            return StaticConfiguration(kind: kind, provider: UsageProvider()) { entry in
                WidgetContent(entry: entry)
            }
            .configurationDisplayName("HRouter 用量")
            .description("跟随应用中选择的 Agent / Follows the Agent selected in the app.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        }
    }
}
