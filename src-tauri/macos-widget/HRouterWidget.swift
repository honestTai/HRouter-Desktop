import Foundation
import SwiftUI
import WidgetKit

private let appGroupIdentifier = "QA2AVNA553.com.hrouter.desktop"
private let summaryRelativePath = "Library/Application Support/HRouter/widget-summary.json"

private struct UsageSummary: Decodable {
    let available: Bool
    let todayUsage: Double
    let balance: Double
    let updatedAt: TimeInterval
}

private struct UsageEntry: TimelineEntry {
    let date: Date
    let summary: UsageSummary?
}

private enum SummaryStore {
    static func load() -> UsageSummary? {
        guard
            let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroupIdentifier
            )
        else {
            return nil
        }

        let url = container.appendingPathComponent(summaryRelativePath)
        guard
            let data = try? Data(contentsOf: url),
            let summary = try? JSONDecoder().decode(UsageSummary.self, from: data),
            summary.available
        else {
            return nil
        }
        return summary
    }
}

private struct UsageProvider: TimelineProvider {
    func placeholder(in context: Context) -> UsageEntry {
        UsageEntry(
            date: Date(),
            summary: UsageSummary(
                available: true,
                todayUsage: 1.28,
                balance: 608.62,
                updatedAt: Date().timeIntervalSince1970
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (UsageEntry) -> Void) {
        completion(UsageEntry(date: Date(), summary: SummaryStore.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<UsageEntry>) -> Void) {
        let now = Date()
        let entry = UsageEntry(date: now, summary: SummaryStore.load())
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: now)
            ?? now.addingTimeInterval(15 * 60)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

private struct WidgetCopy {
    let today: String
    let balance: String
    let updated: String
    let unavailable: String
    let openApp: String

    static var current: WidgetCopy {
        let language = Locale.preferredLanguages.first ?? "en"
        if language.hasPrefix("zh") {
            return WidgetCopy(
                today: "今日用量",
                balance: "剩余余额",
                updated: "更新于",
                unavailable: "暂无用量数据",
                openApp: "打开 HRouter 后自动同步"
            )
        }
        return WidgetCopy(
            today: "Today",
            balance: "Balance",
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

private struct AmountView: View {
    let label: String
    let amount: Double
    let prominent: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(amount, format: .currency(code: "CNY").precision(.fractionLength(2)))
                .font(
                    .system(
                        size: prominent ? 24 : 19,
                        weight: .semibold,
                        design: .rounded
                    )
                )
                .lineLimit(1)
                .minimumScaleFactor(0.68)
                .privacySensitive()
        }
    }
}

private struct WidgetContent: View {
    @Environment(\.widgetFamily) private var family
    let entry: UsageEntry

    private let copy = WidgetCopy.current

    var body: some View {
        Group {
            if let summary = entry.summary {
                if family == .systemMedium {
                    mediumContent(summary)
                } else {
                    smallContent(summary)
                }
            } else {
                unavailableContent
            }
        }
        .modifier(HRouterWidgetBackground())
    }

    private func smallContent(_ summary: UsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                BrandMark()
                Text("HRouter")
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
            }
            Spacer(minLength: 10)
            AmountView(label: copy.today, amount: summary.todayUsage, prominent: true)
            Spacer(minLength: 8)
            Divider()
            Spacer(minLength: 8)
            AmountView(label: copy.balance, amount: summary.balance, prominent: false)
        }
        .padding(14)
    }

    private func mediumContent(_ summary: UsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                BrandMark()
                VStack(alignment: .leading, spacing: 1) {
                    Text("HRouter")
                        .font(.subheadline.weight(.semibold))
                    Text(updatedText(summary.updatedAt))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            Spacer(minLength: 16)
            HStack(alignment: .top, spacing: 22) {
                AmountView(label: copy.today, amount: summary.todayUsage, prominent: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Divider()
                AmountView(label: copy.balance, amount: summary.balance, prominent: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(16)
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
        .description("展示今日用量和剩余余额。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
