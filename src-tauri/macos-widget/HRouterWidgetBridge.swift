import Foundation
import WidgetKit

// A background sync writes several Agent files. Coalesce those updates into one
// WidgetKit reload request instead of consuming its budget once per file.
private var pendingReload: DispatchWorkItem?

@_cdecl("hrouter_reload_widget_timelines")
public func reloadHRouterWidgetTimelines() {
    DispatchQueue.main.async {
        pendingReload?.cancel()
        let work = DispatchWorkItem {
            WidgetCenter.shared.reloadTimelines(ofKind: "com.hrouter.desktop.widget.usage")
            pendingReload = nil
        }
        pendingReload = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: work)
    }
}
