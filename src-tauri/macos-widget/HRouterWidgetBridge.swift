import WidgetKit

@_cdecl("hrouter_reload_widget_timelines")
public func reloadHRouterWidgetTimelines() {
    WidgetCenter.shared.reloadTimelines(ofKind: "com.hrouter.desktop.widget.usage")
}
