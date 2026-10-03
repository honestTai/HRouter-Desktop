//! 项目 Profile 编排服务
//!
//! Profile 是**全应用共享的项目实体**（用户拥有的项目就那几个），payload
//! 按 app 分槽存配置快照（供应商 / MCP / Skills / Prompt）。快照与应用
//! 均**按分组（scope）操作**：Claude Code 与 Codex 的工作目录往往不同
//! （各在各的项目里），因此各组独立指向自己的当前项目、只拍/只应用组内
//! 槽位，互不牵连；重命名/删除作用于共享实体本身。
//! 应用（apply）时复用现有切换原语批量落地：
//! - 供应商：`ProviderService::switch`（内建代理接管热切换与接管下禁切官方）
//! - MCP：`McpService::toggle_app`（改标志 + 单 server 物化）
//! - Skills：`SkillService::toggle_app`（改标志 + 单 skill 物化）
//! - Legacy prompt references are retained for compatibility, but never applied.
//!
//! apply 为 best-effort：单项失败收集为 warning 继续，不整体回滚。

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::app_config::AppType;
use crate::database::Profile;
use crate::error::AppError;
use crate::services::{McpService, ProviderService, SkillService};
use crate::store::AppState;

/// Profile 操作的应用分组：项目实体全应用共享，但快照/应用/当前指针按组进行。
///
/// Claude Code 与 Claude Desktop 的供应商在 cc-switch 中是独立切换的，
/// 因此各自拥有独立的项目分组。两者 live 文件零交集
///（`~/.claude` / `Application Support/Claude-3p`），分组切换互不干扰。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProfileScope {
    Claude,
    #[serde(rename = "claude-desktop")]
    ClaudeDesktop,
    Codex,
    #[serde(rename = "gemini")]
    Gemini,
    #[serde(rename = "grokbuild")]
    GrokBuild,
    #[serde(rename = "opencode")]
    OpenCode,
    #[serde(rename = "openclaw")]
    OpenClaw,
    #[serde(rename = "hermes")]
    Hermes,
    #[serde(rename = "pi")]
    Pi,
    #[serde(rename = "deepseek-harness")]
    DeepSeekHarness,
    #[serde(rename = "workbuddy")]
    WorkBuddy,
}

impl ProfileScope {
    /// 全部分组（扩展新分组时同步扩展 apps/for_app 与前端 scope.ts 镜像）
    pub const ALL: [ProfileScope; 11] = [
        ProfileScope::Claude,
        ProfileScope::ClaudeDesktop,
        ProfileScope::Codex,
        ProfileScope::Gemini,
        ProfileScope::GrokBuild,
        ProfileScope::OpenCode,
        ProfileScope::OpenClaw,
        ProfileScope::Hermes,
        ProfileScope::Pi,
        ProfileScope::DeepSeekHarness,
        ProfileScope::WorkBuddy,
    ];

    pub fn as_str(&self) -> &'static str {
        match self {
            ProfileScope::Claude => "claude",
            ProfileScope::ClaudeDesktop => "claude-desktop",
            ProfileScope::Codex => "codex",
            ProfileScope::Gemini => "gemini",
            ProfileScope::GrokBuild => "grokbuild",
            ProfileScope::OpenCode => "opencode",
            ProfileScope::OpenClaw => "openclaw",
            ProfileScope::Hermes => "hermes",
            ProfileScope::Pi => "pi",
            ProfileScope::DeepSeekHarness => "deepseek-harness",
            ProfileScope::WorkBuddy => "workbuddy",
        }
    }

    pub fn parse(value: &str) -> Result<Self, AppError> {
        match value {
            "claude" => Ok(ProfileScope::Claude),
            "claude-desktop" => Ok(ProfileScope::ClaudeDesktop),
            "codex" => Ok(ProfileScope::Codex),
            "gemini" => Ok(ProfileScope::Gemini),
            "grokbuild" => Ok(ProfileScope::GrokBuild),
            "opencode" => Ok(ProfileScope::OpenCode),
            "openclaw" => Ok(ProfileScope::OpenClaw),
            "hermes" => Ok(ProfileScope::Hermes),
            "pi" => Ok(ProfileScope::Pi),
            "deepseek-harness" => Ok(ProfileScope::DeepSeekHarness),
            "workbuddy" => Ok(ProfileScope::WorkBuddy),

            other => Err(AppError::InvalidInput(format!(
                "Unknown profile scope: {other}"
            ))),
        }
    }

    /// 组内受管应用（快照与 apply 只作用于这些 app 的槽位）
    pub fn apps(&self) -> &'static [AppType] {
        match self {
            ProfileScope::Claude => &[AppType::Claude],
            ProfileScope::ClaudeDesktop => &[AppType::ClaudeDesktop],
            ProfileScope::Codex => &[AppType::Codex],
            ProfileScope::Gemini => &[AppType::Gemini],
            ProfileScope::GrokBuild => &[AppType::GrokBuild],
            ProfileScope::OpenCode => &[AppType::OpenCode],
            ProfileScope::OpenClaw => &[AppType::OpenClaw],
            ProfileScope::Hermes => &[AppType::Hermes],
            ProfileScope::Pi => &[],
            ProfileScope::DeepSeekHarness => &[],
            ProfileScope::WorkBuddy => &[],
        }
    }

    /// 应用页 → 所属分组（Profile 不支持的应用返回 None）
    pub fn for_app(app: &AppType) -> Option<Self> {
        match app {
            AppType::Claude => Some(ProfileScope::Claude),
            AppType::ClaudeDesktop => Some(ProfileScope::ClaudeDesktop),
            AppType::Codex => Some(ProfileScope::Codex),
            AppType::Gemini => Some(ProfileScope::Gemini),
            AppType::GrokBuild => Some(ProfileScope::GrokBuild),
            AppType::OpenCode => Some(ProfileScope::OpenCode),
            AppType::OpenClaw => Some(ProfileScope::OpenClaw),
            AppType::Hermes => Some(ProfileScope::Hermes),
        }
    }
}

/// 按 app 分槽的载荷容器；字段名与 AppType 的 serde 形式一致
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct PerApp<T> {
    pub claude: T,
    #[serde(rename = "claude-desktop")]
    pub claude_desktop: T,
    pub codex: T,
    #[serde(rename = "gemini")]
    pub gemini: T,
    #[serde(rename = "grokbuild")]
    pub grokbuild: T,
    #[serde(rename = "opencode")]
    pub opencode: T,
    #[serde(rename = "openclaw")]
    pub openclaw: T,
    #[serde(rename = "hermes")]
    pub hermes: T,
    #[serde(rename = "pi")]
    pub pi: T,
    #[serde(rename = "deepseek-harness")]
    pub deepseek_harness: T,
    #[serde(rename = "workbuddy")]
    pub workbuddy: T,
}

impl<T> PerApp<T> {
    pub fn get(&self, app: &AppType) -> Option<&T> {
        match app {
            AppType::Claude => Some(&self.claude),
            AppType::ClaudeDesktop => Some(&self.claude_desktop),
            AppType::Codex => Some(&self.codex),
            AppType::Gemini => Some(&self.gemini),
            AppType::GrokBuild => Some(&self.grokbuild),
            AppType::OpenCode => Some(&self.opencode),
            AppType::OpenClaw => Some(&self.openclaw),
            AppType::Hermes => Some(&self.hermes),
        }
    }

    pub fn get_mut(&mut self, app: &AppType) -> Option<&mut T> {
        match app {
            AppType::Claude => Some(&mut self.claude),
            AppType::ClaudeDesktop => Some(&mut self.claude_desktop),
            AppType::Codex => Some(&mut self.codex),
            AppType::Gemini => Some(&mut self.gemini),
            AppType::GrokBuild => Some(&mut self.grokbuild),
            AppType::OpenCode => Some(&mut self.opencode),
            AppType::OpenClaw => Some(&mut self.openclaw),
            AppType::Hermes => Some(&mut self.hermes),
        }
    }
    pub fn for_scope(&self, scope: ProfileScope) -> &T {
        match scope {
            ProfileScope::Claude => &self.claude,
            ProfileScope::ClaudeDesktop => &self.claude_desktop,
            ProfileScope::Codex => &self.codex,
            ProfileScope::Gemini => &self.gemini,
            ProfileScope::GrokBuild => &self.grokbuild,
            ProfileScope::OpenCode => &self.opencode,
            ProfileScope::OpenClaw => &self.openclaw,
            ProfileScope::Hermes => &self.hermes,
            ProfileScope::Pi => &self.pi,
            ProfileScope::DeepSeekHarness => &self.deepseek_harness,
            ProfileScope::WorkBuddy => &self.workbuddy,
        }
    }
    pub fn for_scope_mut(&mut self, scope: ProfileScope) -> &mut T {
        match scope {
            ProfileScope::Claude => &mut self.claude,
            ProfileScope::ClaudeDesktop => &mut self.claude_desktop,
            ProfileScope::Codex => &mut self.codex,
            ProfileScope::Gemini => &mut self.gemini,
            ProfileScope::GrokBuild => &mut self.grokbuild,
            ProfileScope::OpenCode => &mut self.opencode,
            ProfileScope::OpenClaw => &mut self.openclaw,
            ProfileScope::Hermes => &mut self.hermes,
            ProfileScope::Pi => &mut self.pi,
            ProfileScope::DeepSeekHarness => &mut self.deepseek_harness,
            ProfileScope::WorkBuddy => &mut self.workbuddy,
        }
    }
}

/// Profile 的 JSON 快照结构（与前端 TS 类型严格对应）
///
/// 所有槽位都是 Option：None = 该侧从未拍过快照（应用时不动），
/// 与"拍到的就是空集/无激活项"（Some(空)，应用时清空启用）严格区分——
/// 在 Codex 页选中一个只在 Claude 页建过的项目不能误清 Codex 的启用状态。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct ProfilePayload {
    /// 每 app 的当前供应商 id
    pub providers: PerApp<Option<String>>,
    /// Additive Agents store the set of managed live providers, without touching foreign entries.
    pub enabled_providers: PerApp<Option<Vec<String>>>,
    /// 每 app 启用的 MCP server id 集合
    pub mcp: PerApp<Option<Vec<String>>>,
    /// 每 app 启用的 Skill id 集合
    pub skills: PerApp<Option<Vec<String>>>,
    /// 每 app 激活的 prompt id
    pub prompts: PerApp<Option<String>>,
}

impl ProfilePayload {
    /// 用另一份快照覆盖本载荷中某分组的槽位，其余分组原样保留
    /// （"以当前状态更新"只更新发起页所属分组，避免把别的应用
    /// 正处于其他项目的状态串进来）
    pub fn merge_scope_from(&mut self, other: &ProfilePayload, scope: ProfileScope) {
        *self.providers.for_scope_mut(scope) = other.providers.for_scope(scope).clone();
        *self.enabled_providers.for_scope_mut(scope) =
            other.enabled_providers.for_scope(scope).clone();
        *self.mcp.for_scope_mut(scope) = other.mcp.for_scope(scope).clone();
        *self.skills.for_scope_mut(scope) = other.skills.for_scope(scope).clone();
        // Legacy prompts stay inert and unchanged.
    }

    /// 某分组是否拍过快照（任一槽位非 None 即视为拍过）
    pub fn scope_captured(&self, scope: ProfileScope) -> bool {
        self.providers.for_scope(scope).is_some()
            || self.enabled_providers.for_scope(scope).is_some()
            || self.mcp.for_scope(scope).is_some()
            || self.skills.for_scope(scope).is_some()
    }
}

/// 计算从当前启用状态到目标集合的最小 toggle 集
///
/// 返回 (需要执行的 (id, enabled) 列表, payload 中已不存在于 DB 的悬空 id 列表)
fn plan_toggles(
    current: &[(String, bool)],
    target_ids: &[String],
) -> (Vec<(String, bool)>, Vec<String>) {
    let existing: HashSet<&str> = current.iter().map(|(id, _)| id.as_str()).collect();
    let target: HashSet<&str> = target_ids.iter().map(|s| s.as_str()).collect();

    let toggles = current
        .iter()
        .filter(|(id, enabled)| target.contains(id.as_str()) != *enabled)
        .map(|(id, enabled)| (id.clone(), !enabled))
        .collect();

    let dangling = target_ids
        .iter()
        .filter(|id| !existing.contains(id.as_str()))
        .cloned()
        .collect();

    (toggles, dangling)
}

pub struct ProfileService;

fn live_provider_ids(app: &AppType) -> Result<Vec<String>, AppError> {
    Ok(match app {
        AppType::OpenCode => crate::opencode_config::get_providers()?
            .keys()
            .cloned()
            .collect(),
        AppType::OpenClaw => crate::openclaw_config::get_providers()?
            .keys()
            .cloned()
            .collect(),
        AppType::Hermes => crate::hermes_config::get_providers()?
            .keys()
            .cloned()
            .collect(),
        _ => Vec::new(),
    })
}

impl ProfileService {
    /// 抓取分组内应用的当前配置状态生成快照（组外槽位保持默认值）
    pub fn snapshot_current(
        state: &AppState,
        scope: ProfileScope,
    ) -> Result<ProfilePayload, AppError> {
        let mut payload = ProfilePayload::default();
        let mcp_servers = state.db.get_all_mcp_servers()?;
        let skills = state.db.get_all_installed_skills()?;

        if scope.apps().is_empty() {
            *payload.providers.for_scope_mut(scope) =
                state.db.get_current_provider(scope.as_str())?;
            let target: crate::ResourceTarget =
                scope.as_str().parse().map_err(AppError::InvalidInput)?;
            *payload.mcp.for_scope_mut(scope) = Some(
                mcp_servers
                    .values()
                    .filter(|server| server.apps.is_enabled_for(target))
                    .map(|server| server.id.clone())
                    .collect(),
            );
            *payload.skills.for_scope_mut(scope) = Some(
                skills
                    .values()
                    .filter(|skill| skill.apps.is_enabled_for(target))
                    .map(|skill| skill.id.clone())
                    .collect(),
            );
            return Ok(payload);
        }
        for app in scope.apps().iter() {
            if app.is_additive_mode() {
                let managed = state.db.get_all_providers(app.as_str())?;
                *payload.enabled_providers.for_scope_mut(scope) = Some(
                    live_provider_ids(app)?
                        .into_iter()
                        .filter(|id| managed.contains_key(id))
                        .collect(),
                );
            }
            if let Some(slot) = payload.providers.get_mut(app) {
                *slot = crate::settings::get_effective_current_provider(&state.db, app)?;
            }
            {
                if let Some(slot) = payload.mcp.get_mut(app) {
                    *slot = Some(
                        mcp_servers
                            .values()
                            .filter(|s| s.apps.is_enabled_for(app))
                            .map(|s| s.id.clone())
                            .collect(),
                    );
                }
            }
            if !matches!(app, AppType::ClaudeDesktop) {
                if let Some(slot) = payload.skills.get_mut(app) {
                    *slot = Some(
                        skills
                            .values()
                            .filter(|s| s.apps.is_enabled_for(app))
                            .map(|s| s.id.clone())
                            .collect(),
                    );
                }
            }
            // Prompt management was removed. Do not read or snapshot prompt state.
        }
        Ok(payload)
    }

    /// 列出所有项目（项目实体全应用共享，current 标记按分组单独读取）
    pub fn list(state: &AppState) -> Result<Vec<Profile>, AppError> {
        state.db.get_all_profiles()
    }

    /// 创建新项目：只拍发起页所属分组的当前状态，其余分组槽位留 None
    /// （其他应用可能正处于别的项目，不能替用户拍进来）
    pub fn create(state: &AppState, name: &str, scope: ProfileScope) -> Result<Profile, AppError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::InvalidInput("Profile name is empty".to_string()));
        }
        let payload = Self::snapshot_current(state, scope)?;
        let now = chrono::Utc::now().timestamp();
        let profile = Profile {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            payload: serde_json::to_string(&payload)
                .map_err(|e| AppError::Config(format!("序列化 profile payload 失败: {e}")))?,
            sort_order: None,
            created_at: Some(now),
            updated_at: Some(now),
        };
        state.db.save_profile(&profile)?;
        Ok(profile)
    }

    /// 更新项目：重命名（作用于共享实体）和/或以当前状态重拍快照
    /// （resnapshot 只覆盖 scope 分组的槽位，其余分组原样保留；
    /// 快照重拍仅由 [`Self::apply`] 切换前的自动保存触发，UI 不再暴露手动入口）
    pub fn update(
        state: &AppState,
        id: &str,
        name: Option<String>,
        resnapshot: bool,
        scope: Option<ProfileScope>,
    ) -> Result<Profile, AppError> {
        let mut profile = state
            .db
            .get_profile(id)?
            .ok_or_else(|| AppError::InvalidInput(format!("Profile not found: {id}")))?;

        if let Some(name) = name {
            let name = name.trim().to_string();
            if name.is_empty() {
                return Err(AppError::InvalidInput("Profile name is empty".to_string()));
            }
            profile.name = name;
        }
        if resnapshot {
            let scope = scope.ok_or_else(|| {
                AppError::InvalidInput("Resnapshot requires a profile scope".to_string())
            })?;
            let mut payload: ProfilePayload = serde_json::from_str(&profile.payload)
                .map_err(|e| AppError::Config(format!("解析 profile payload 失败: {e}")))?;
            payload.merge_scope_from(&Self::snapshot_current(state, scope)?, scope);
            profile.payload = serde_json::to_string(&payload)
                .map_err(|e| AppError::Config(format!("序列化 profile payload 失败: {e}")))?;
        }
        profile.updated_at = Some(chrono::Utc::now().timestamp());
        state.db.save_profile(&profile)?;
        Ok(profile)
    }

    /// 删除项目；若删除的是某分组当前激活项目，一并清除该分组的激活标记
    pub fn delete(state: &AppState, id: &str) -> Result<(), AppError> {
        state.db.delete_profile(id)?;
        for scope in ProfileScope::ALL {
            if state.db.get_current_profile_id(scope.as_str())?.as_deref() == Some(id) {
                state.db.set_current_profile_id(scope.as_str(), None)?;
            }
        }
        Ok(())
    }

    /// 应用项目快照（best-effort，返回 warnings）
    ///
    /// 只作用于发起页所属分组内的应用，不碰其他分组的配置与 current 标记。
    /// 该分组从未拍过快照时不改动任何配置，仅标记 current 并返回提示
    /// （下次从该项目切走时，自动保存会补拍该侧快照）。
    ///
    /// **切换前会自动保存旧项目**：若当前分组已绑定到另一个项目，先把当前
    /// 状态写入那个旧项目（仅当前分组槽位），再加载目标项目。这样切走后
    /// 旧项目仍保留离开时的配置，回来时状态一致。自动保存失败时作为 warning
    /// 继续，不阻塞切换。
    ///
    /// 应用指定项目的快照到当前分组内的所有应用。
    ///
    /// 返回 `(warnings, should_stop_proxy)`：当当前分组内所有接管都被关闭、且
    /// 其它应用也没有接管时，建议调用者停止代理服务，以便 Claude Desktop 的
    /// "本地路由"总开关同步显示为关闭。
    pub fn apply(
        state: &AppState,
        profile_id: &str,
        scope: ProfileScope,
    ) -> Result<(Vec<String>, bool), AppError> {
        let mut warnings = Vec::new();

        // 自动保存旧项目当前状态（仅当前分组），失败不阻塞切换
        if let Some(current_id) = state.db.get_current_profile_id(scope.as_str())? {
            if current_id != profile_id {
                if let Err(e) = Self::update(state, &current_id, None, true, Some(scope)) {
                    warnings.push(format!(
                        "autosave profile '{current_id}' before switch failed: {e}"
                    ));
                }
            }
        }

        let profile = state
            .db
            .get_profile(profile_id)?
            .ok_or_else(|| AppError::InvalidInput(format!("Profile not found: {profile_id}")))?;
        let payload: ProfilePayload = serde_json::from_str(&profile.payload)
            .map_err(|e| AppError::Config(format!("解析 profile payload 失败: {e}")))?;

        if !payload.scope_captured(scope) {
            warnings.push(format!(
                "no {} configuration captured in this project yet; marked as current without changes (it will be saved automatically when you switch away)",
                scope.as_str()
            ));
        }

        if scope.apps().is_empty() {
            if let Some(id) = payload.providers.for_scope(scope) {
                match crate::file_provider_service::switch(state, scope.as_str(), id, None) {
                    Ok(result) => warnings.extend(result.warnings),
                    Err(error) => warnings.push(format!("[{}] {error}", scope.as_str())),
                }
            }
        }
        if scope.apps().is_empty() {
            let target: crate::ResourceTarget =
                scope.as_str().parse().map_err(AppError::InvalidInput)?;
            if let Some(ids) = payload.mcp.for_scope(scope) {
                let servers = state.db.get_all_mcp_servers()?;
                let current = servers
                    .values()
                    .map(|s| (s.id.clone(), s.apps.is_enabled_for(target)))
                    .collect::<Vec<_>>();
                let (toggles, dangling) = plan_toggles(&current, ids);
                for id in dangling {
                    warnings.push(format!("[{}] MCP '{id}' no longer exists", scope.as_str()));
                }
                for (id, enabled) in toggles {
                    if let Err(error) = McpService::toggle_app(state, &id, target, enabled) {
                        warnings.push(format!("[{}] {error}", scope.as_str()));
                    }
                }
            }
            if let Some(ids) = payload.skills.for_scope(scope) {
                let skills = state.db.get_all_installed_skills()?;
                let current = skills
                    .values()
                    .map(|s| (s.id.clone(), s.apps.is_enabled_for(target)))
                    .collect::<Vec<_>>();
                let (toggles, dangling) = plan_toggles(&current, ids);
                for id in dangling {
                    warnings.push(format!(
                        "[{}] skill '{id}' no longer exists",
                        scope.as_str()
                    ));
                }
                for (id, enabled) in toggles {
                    if let Err(error) = SkillService::toggle_app(&state.db, &id, target, enabled) {
                        warnings.push(format!("[{}] {error}", scope.as_str()));
                    }
                }
            }
        }
        for app in scope.apps().iter() {
            let app_str = app.as_str();

            // 1. 切换项目前无条件关闭当前应用的代理接管。
            // 接管态下 live 文件属于代理；用户希望切换工作目录时总是退出当前
            // 代理环境，再按快照写入真实供应商配置。
            if matches!(
                app,
                AppType::Claude
                    | AppType::ClaudeDesktop
                    | AppType::Codex
                    | AppType::Gemini
                    | AppType::GrokBuild
            ) {
                if let Err(e) = state.proxy_service.disable_takeover_for_app_sync(app) {
                    warnings.push(format!(
                        "[{app_str}] auto-disable proxy takeover before profile switch failed: {e}"
                    ));
                }
            }
            // 2. 供应商
            if let Some(Some(target_pid)) = payload.providers.get(app) {
                let providers = state.db.get_all_providers(app_str)?;
                if !providers.contains_key(target_pid) {
                    warnings.push(format!(
                        "[{app_str}] provider '{target_pid}' no longer exists, skipped"
                    ));
                } else {
                    let current = crate::settings::get_effective_current_provider(&state.db, app)?;
                    if current.as_deref() != Some(target_pid.as_str()) {
                        match ProviderService::switch(state, app.clone(), target_pid) {
                            Ok(result) => warnings.extend(result.warnings),
                            Err(e) => warnings.push(format!(
                                "[{app_str}] switch provider '{target_pid}' failed: {e}"
                            )),
                        }
                    }
                }
            }

            if app.is_additive_mode() {
                if let Some(targets) = payload.enabled_providers.for_scope(scope) {
                    let managed = state.db.get_all_providers(app_str)?;
                    let live = live_provider_ids(app)?;
                    for id in targets {
                        if managed.contains_key(id) {
                            match ProviderService::switch(state, app.clone(), id) {
                                Ok(result) => warnings.extend(result.warnings),
                                Err(error) => warnings.push(format!("[{app_str}] {error}")),
                            }
                        } else {
                            warnings.push(format!("[{app_str}] provider '{id}' no longer exists"));
                        }
                    }
                    // Never remove working entries if adding a target failed.
                    if warnings.is_empty() {
                        for id in live
                            .iter()
                            .filter(|id| managed.contains_key(*id) && !targets.contains(*id))
                        {
                            if let Err(error) =
                                ProviderService::remove_from_live_config(state, app.clone(), id)
                            {
                                warnings.push(format!("[{app_str}] {error}"));
                            }
                        }
                    }
                }
            }
            // 3. MCP diff（最小 toggle：仅动目标态≠当前态的条目；None = 该侧未拍过，不动）
            if let Some(Some(target_ids)) = payload.mcp.get(app) {
                let servers = state.db.get_all_mcp_servers()?;
                let current: Vec<(String, bool)> = servers
                    .values()
                    .map(|s| (s.id.clone(), s.apps.is_enabled_for(app)))
                    .collect();
                let (toggles, dangling) = plan_toggles(&current, target_ids);
                for id in dangling {
                    warnings.push(format!("[{app_str}] MCP '{id}' no longer exists, skipped"));
                }
                for (id, enabled) in toggles {
                    if let Err(e) = McpService::toggle_app(state, &id, app, enabled) {
                        warnings.push(format!(
                            "[{app_str}] toggle MCP '{id}' -> {enabled} failed: {e}"
                        ));
                    }
                }
            }

            // 4. Skills diff（SkillService 返回 anyhow::Result，收进 warning）
            if let Some(Some(target_ids)) = payload.skills.get(app) {
                let skills = state.db.get_all_installed_skills()?;
                let current: Vec<(String, bool)> = skills
                    .values()
                    .map(|s| (s.id.clone(), s.apps.is_enabled_for(app)))
                    .collect();
                let (toggles, dangling) = plan_toggles(&current, target_ids);
                for id in dangling {
                    warnings.push(format!(
                        "[{app_str}] skill '{id}' no longer exists, skipped"
                    ));
                }
                for (id, enabled) in toggles {
                    if let Err(e) = SkillService::toggle_app(&state.db, &id, app, enabled) {
                        warnings.push(format!(
                            "[{app_str}] toggle skill '{id}' -> {enabled} failed: {e}"
                        ));
                    }
                }
            }

            // Legacy payload.prompts is intentionally ignored; original files stay untouched.
        }

        state
            .db
            .set_current_profile_id(scope.as_str(), Some(profile_id))?;

        // 当前分组内所有接管已关闭；若其它应用也无接管，可停止代理服务。
        let should_stop_proxy = !state.db.is_live_takeover_active_sync();

        Ok((warnings, should_stop_proxy))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn test_payload_serde_roundtrip() {
        let payload = ProfilePayload {
            providers: PerApp {
                claude: Some("p1".into()),
                claude_desktop: Some("d1".into()),
                codex: None,
                ..Default::default()
            },
            mcp: PerApp {
                claude: Some(ids(&["m1", "m2"])),
                claude_desktop: Some(vec![]),
                codex: None,
                ..Default::default()
            },
            skills: PerApp {
                claude: Some(vec![]),
                claude_desktop: Some(vec![]),
                codex: Some(ids(&["s1"])),
                ..Default::default()
            },
            enabled_providers: PerApp::default(),
            prompts: PerApp {
                claude: None,
                claude_desktop: None,
                codex: Some("pr1".into()),
                ..Default::default()
            },
        };
        let json = serde_json::to_string(&payload).unwrap();
        // per-app key 必须与 AppType 的 serde 形式一致（claude-desktop 是连字符）
        assert!(json.contains("\"claude\""));
        assert!(json.contains("\"claude-desktop\""));
        assert!(json.contains("\"codex\""));
        let back: ProfilePayload = serde_json::from_str(&json).unwrap();
        assert_eq!(back, payload);
    }

    #[test]
    fn legacy_prompt_only_snapshot_is_inert() {
        let mut payload = ProfilePayload::default();
        payload.prompts.claude = Some("keep-user-prompt".into());
        assert!(!payload.scope_captured(ProfileScope::Claude));
        payload.merge_scope_from(&ProfilePayload::default(), ProfileScope::Claude);
        assert_eq!(payload.prompts.claude.as_deref(), Some("keep-user-prompt"));
    }

    #[test]
    fn test_payload_tolerates_missing_fields() {
        // 前向兼容：旧版/部分字段缺失时应落到 None（"该侧未拍过"）而不是报错，
        // 应用时对缺失槽位不做任何改动
        let back: ProfilePayload =
            serde_json::from_str(r#"{"providers":{"claude":"p1"},"mcp":{"claude":["m1"]}}"#)
                .unwrap();
        assert_eq!(back.providers.claude, Some("p1".to_string()));
        assert_eq!(back.providers.claude_desktop, None);
        assert_eq!(back.providers.codex, None);
        assert_eq!(back.mcp.claude, Some(ids(&["m1"])));
        assert_eq!(back.mcp.claude_desktop, None);
        assert_eq!(back.mcp.codex, None, "missing slot means untouched");
        assert_eq!(back.prompts.codex, None);

        let empty: ProfilePayload = serde_json::from_str("{}").unwrap();
        assert_eq!(empty, ProfilePayload::default());
    }

    #[test]
    fn test_merge_scope_from_only_touches_scope_slots() {
        // 项目 A：两侧都已拍过快照
        let mut payload = ProfilePayload {
            providers: PerApp {
                claude: Some("p1".into()),
                claude_desktop: Some("d1".into()),
                codex: Some("c1".into()),
                ..Default::default()
            },
            mcp: PerApp {
                claude: Some(ids(&["m1"])),
                claude_desktop: Some(vec![]),
                codex: Some(ids(&["m9"])),
                ..Default::default()
            },
            ..Default::default()
        };
        // 在 Claude 页"以当前状态更新"：只覆盖 claude 组槽位
        let fresh = ProfilePayload {
            providers: PerApp {
                claude: Some("p2".into()),
                claude_desktop: None,
                codex: Some("SHOULD-NOT-LEAK".into()),
                ..Default::default()
            },
            mcp: PerApp {
                claude: Some(ids(&["m2"])),
                claude_desktop: Some(vec![]),
                codex: None,
                ..Default::default()
            },
            ..Default::default()
        };
        payload.merge_scope_from(&fresh, ProfileScope::Claude);

        assert_eq!(payload.providers.claude, Some("p2".to_string()));
        assert_eq!(
            payload.providers.claude_desktop,
            Some("d1".to_string()),
            "claude-desktop slot is in its own scope, untouched by claude merge"
        );
        assert_eq!(payload.mcp.claude, Some(ids(&["m2"])));
        // codex 侧完好：既没被覆盖也没被 fresh 的值污染
        assert_eq!(payload.providers.codex, Some("c1".to_string()));
        assert_eq!(payload.mcp.codex, Some(ids(&["m9"])));
    }

    #[test]
    fn test_scope_captured_detects_per_scope_snapshot() {
        let mut payload = ProfilePayload::default();
        assert!(!payload.scope_captured(ProfileScope::Claude));
        assert!(!payload.scope_captured(ProfileScope::ClaudeDesktop));
        assert!(!payload.scope_captured(ProfileScope::Codex));

        // 只拍过 claude 组（哪怕拍到的是空集）
        payload.mcp.claude = Some(vec![]);
        assert!(payload.scope_captured(ProfileScope::Claude));
        assert!(!payload.scope_captured(ProfileScope::ClaudeDesktop));
        assert!(!payload.scope_captured(ProfileScope::Codex));

        // Desktop 槽位属于独立的 claude-desktop 组
        let mut desktop_only = ProfilePayload::default();
        desktop_only.providers.claude_desktop = Some("d1".into());
        assert!(desktop_only.scope_captured(ProfileScope::ClaudeDesktop));
        assert!(!desktop_only.scope_captured(ProfileScope::Claude));
    }

    #[test]
    fn test_per_app_get_only_supports_profile_apps() {
        let per: PerApp<Option<String>> = PerApp::default();
        assert!(per.get(&AppType::Claude).is_some());
        assert!(per.get(&AppType::ClaudeDesktop).is_some());
        assert!(per.get(&AppType::Codex).is_some());
        assert!(per.get(&AppType::Gemini).is_some());
    }

    #[test]
    fn test_scope_serde_and_parse_roundtrip() {
        for scope in ProfileScope::ALL {
            // DB 存储字符串（as_str/parse）与 JSON 序列化必须是同一形式
            assert_eq!(
                serde_json::to_string(&scope).unwrap(),
                format!("\"{}\"", scope.as_str())
            );
            assert_eq!(ProfileScope::parse(scope.as_str()).unwrap(), scope);
        }
        assert!(ProfileScope::parse("unknown-agent").is_err());
        assert!(ProfileScope::parse("").is_err());
    }

    #[test]
    fn test_scope_app_grouping() {
        // Claude Code 与 Claude Desktop 各自独立成组；
        // 组内应用与 for_app 反向映射必须一致
        assert_eq!(ProfileScope::Claude.apps(), &[AppType::Claude]);
        assert_eq!(
            ProfileScope::ClaudeDesktop.apps(),
            &[AppType::ClaudeDesktop]
        );
        assert_eq!(ProfileScope::Codex.apps(), &[AppType::Codex]);
        for scope in ProfileScope::ALL {
            for app in scope.apps() {
                assert_eq!(ProfileScope::for_app(app), Some(scope));
            }
        }
        assert_eq!(
            ProfileScope::for_app(&AppType::Gemini),
            Some(ProfileScope::Gemini)
        );
    }

    #[test]
    fn every_agent_snapshot_merges_only_its_own_scope() {
        for scope in ProfileScope::ALL {
            let mut target = ProfilePayload::default();
            let mut fresh = ProfilePayload::default();
            for other in ProfileScope::ALL {
                *target.providers.for_scope_mut(other) = Some(format!("old-{}", other.as_str()));
                *target.enabled_providers.for_scope_mut(other) = Some(ids(&["old-live"]));
                *target.prompts.for_scope_mut(other) = Some("legacy-prompt".into());
                *fresh.providers.for_scope_mut(other) = Some(format!("new-{}", other.as_str()));
                *fresh.enabled_providers.for_scope_mut(other) = Some(ids(&["new-live"]));
            }
            target.merge_scope_from(&fresh, scope);
            for other in ProfileScope::ALL {
                let prefix = if other == scope { "new" } else { "old" };
                assert_eq!(
                    target.providers.for_scope(other).as_deref(),
                    Some(format!("{prefix}-{}", other.as_str()).as_str())
                );
                assert_eq!(
                    target.enabled_providers.for_scope(other),
                    &Some(ids(&[&format!("{prefix}-live")]))
                );
                assert_eq!(
                    target.prompts.for_scope(other).as_deref(),
                    Some("legacy-prompt")
                );
            }
            let restored: ProfilePayload =
                serde_json::from_str(&serde_json::to_string(&target).unwrap()).unwrap();
            assert_eq!(restored, target);
        }
    }

    #[test]
    fn empty_additive_snapshot_is_captured_but_legacy_missing_slots_are_not() {
        let mut payload: ProfilePayload =
            serde_json::from_str(r#"{"providers":{"codex":"p"}}"#).unwrap();
        for scope in ProfileScope::ALL {
            assert_eq!(payload.scope_captured(scope), scope == ProfileScope::Codex);
        }
        payload.enabled_providers.openclaw = Some(vec![]);
        assert!(payload.scope_captured(ProfileScope::OpenClaw));
        assert!(!payload.scope_captured(ProfileScope::Hermes));
    }

    #[test]
    fn test_plan_toggles_minimal_diff() {
        let current = vec![
            ("a".to_string(), true),  // 目标含 a：不动
            ("b".to_string(), false), // 目标含 b：开
            ("c".to_string(), true),  // 目标不含 c：关
            ("d".to_string(), false), // 目标不含 d：不动
        ];
        let (toggles, dangling) = plan_toggles(&current, &ids(&["a", "b", "ghost"]));
        assert_eq!(
            toggles,
            vec![("b".to_string(), true), ("c".to_string(), false)]
        );
        assert_eq!(dangling, ids(&["ghost"]));
    }

    #[test]
    fn test_plan_toggles_empty_target_disables_all_enabled() {
        let current = vec![("a".to_string(), true), ("b".to_string(), false)];
        let (toggles, dangling) = plan_toggles(&current, &[]);
        assert_eq!(toggles, vec![("a".to_string(), false)]);
        assert!(dangling.is_empty());
    }
}
