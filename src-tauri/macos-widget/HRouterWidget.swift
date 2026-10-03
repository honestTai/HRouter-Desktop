import Foundation
import SwiftUI
import WidgetKit

private let appGroupIdentifier = "QA2AVNA553.com.hrouter.desktop"

private struct AgentSummary: Decodable {
    let app: String
    let providerId: String?
    let revision: String?
    let tokens: Double
    let cacheRate: Double
    let speed: Double?
    let updatedAt: TimeInterval

    var name: String {
        ["claude": "Claude Code", "claude-desktop": "Claude Desktop", "codex": "Codex",
         "gemini": "Gemini", "grokbuild": "Grok Build", "opencode": "OpenCode",
         "openclaw": "OpenClaw", "hermes": "Hermes", "pi": "Pi Agent",
         "deepseek": "DeepSeek Harness", "deepseek-harness": "DeepSeek Harness", "workbuddy": "WorkBuddy"][app] ?? app
    }
}

private struct AgentFinance: Decodable {
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

private struct UsageEntry: TimelineEntry {
    let date: Date
    var agent: AgentSummary? = nil
    var finance: AgentFinance? = nil
}

private enum SummaryStore {
    static func read<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier),
              let data = try? Data(contentsOf: container.appendingPathComponent("Library/Application Support/HRouter/\(name)")) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    static func entry() -> UsageEntry {
        let now = Date()
        var agent = read("agent-summary.json", as: AgentSummary.self)
        if let value = agent, !Calendar.current.isDate(Date(timeIntervalSince1970: value.updatedAt), inSameDayAs: now) { agent = nil }
        var finance = read("agent-finance.json", as: AgentFinance.self)
        if let value = finance {
            if value.app != agent?.app || value.providerId != agent?.providerId || value.revision != agent?.revision || now.timeIntervalSince1970 - value.updatedAt > 300 {
                finance = nil
            }
        }
        return UsageEntry(date: now, agent: agent, finance: finance)
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
        let now = Date()
        let entry = SummaryStore.entry()
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: now)
            ?? now.addingTimeInterval(15 * 60)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
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
                    if let speed = agent.speed, Date().timeIntervalSince1970 - agent.updatedAt <= 300 {
                        Text("\(speed, specifier: "%.1f") tok/s").font(.caption.weight(.semibold))
                    } else if let tpm = entry.finance?.tpm {
                        Text("\(isChinese ? "吞吐" : "Throughput") \(tpm, specifier: "%.0f") tok/min").font(.caption)
                    } else {
                        Text(isChinese ? "速度：暂无计时" : "Speed: no timing").font(.caption2).foregroundStyle(.secondary)
                    }
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
                HStack {
                    Text(agent.speed == nil && entry.finance?.tpm != nil ? (isChinese ? "Key 吞吐速率" : "Key throughput") : (isChinese ? "生成速度" : "Generation"))
                    Spacer()
                    if let speed = agent.speed, Date().timeIntervalSince1970 - agent.updatedAt <= 300 {
                        Text("\(speed, specifier: "%.1f") tok/s")
                    } else if let tpm = entry.finance?.tpm {
                        Text("\(tpm, specifier: "%.0f") tok/min").accessibilityLabel(isChinese ? "Key 吞吐速率，非生成速度" : "Key throughput, not generation speed")
                    } else {
                        Text(isChinese ? "暂无计时样本" : "No timing samples").foregroundStyle(.secondary)
                    }
                }.font(.caption)
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

@main
struct HRouterUsageWidget: Widget {
    private let kind = "com.hrouter.desktop.widget.usage"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: UsageProvider()) { entry in
            WidgetContent(entry: entry)
        }
        .configurationDisplayName("HRouter 用量")
        .description("展示所选 Agent 的 Tokens、缓存、速度，以及接口返回的花费与余额。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
