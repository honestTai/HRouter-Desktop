//! MCP / Skills destinations are independent of provider routing implementations.
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ResourceTarget {
    Claude,
    ClaudeDesktop,
    Codex,
    Gemini,
    #[serde(rename = "grokbuild")]
    GrokBuild,
    #[serde(rename = "opencode")]
    OpenCode,
    #[serde(rename = "openclaw")]
    OpenClaw,
    Hermes,
    Pi,
    DeepseekHarness,
    Workbuddy,
}
impl ResourceTarget {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::ClaudeDesktop => "claude-desktop",
            Self::Codex => "codex",
            Self::Gemini => "gemini",
            Self::GrokBuild => "grokbuild",
            Self::OpenCode => "opencode",
            Self::OpenClaw => "openclaw",
            Self::Hermes => "hermes",
            Self::Pi => "pi",
            Self::DeepseekHarness => "deepseek-harness",
            Self::Workbuddy => "workbuddy",
        }
    }
    pub fn all() -> Vec<Self> {
        vec![
            Self::Claude,
            Self::ClaudeDesktop,
            Self::Codex,
            Self::Gemini,
            Self::GrokBuild,
            Self::OpenCode,
            Self::OpenClaw,
            Self::Hermes,
            Self::Pi,
            Self::DeepseekHarness,
            Self::Workbuddy,
        ]
    }
    /// Desktop uses portable bundles/account import, not direct filesystem synchronization.
    pub fn skill_targets() -> Vec<Self> {
        Self::all()
            .into_iter()
            .filter(|app| *app != Self::ClaudeDesktop)
            .collect()
    }
    pub fn mcp_targets() -> Vec<Self> {
        Self::all()
    }
}
impl FromStr for ResourceTarget {
    type Err = String;
    fn from_str(value: &str) -> Result<Self, String> {
        Self::all()
            .into_iter()
            .find(|v| v.as_str() == value)
            .ok_or_else(|| format!("Unknown resource destination: {value}"))
    }
}
impl From<&crate::app_config::AppType> for ResourceTarget {
    fn from(app: &crate::app_config::AppType) -> Self {
        app.as_str()
            .parse()
            .expect("all native provider types have resource destinations")
    }
}
impl From<&ResourceTarget> for ResourceTarget {
    fn from(app: &ResourceTarget) -> Self {
        *app
    }
}
impl fmt::Display for ResourceTarget {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl From<crate::app_config::AppType> for ResourceTarget {
    fn from(app: crate::app_config::AppType) -> Self {
        (&app).into()
    }
}
