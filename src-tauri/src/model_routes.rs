use crate::{database::Database, error::AppError};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRoute {
    pub model: String,
    pub providers: Vec<String>,
}

pub fn read(db: &Database, app: &str) -> Result<Vec<ModelRoute>, AppError> {
    let raw = db
        .get_setting(&format!("model_routes_{app}"))?
        .unwrap_or_else(|| "[]".into());
    serde_json::from_str(&raw).map_err(|_| AppError::Config("模型路由配置无效".into()))
}
pub fn save(db: &Database, app: &str, routes: Vec<ModelRoute>) -> Result<(), AppError> {
    if !matches!(app, "claude" | "codex") || routes.len() > 100 {
        return Err(AppError::InvalidInput(
            "模型路由仅支持 Claude/Codex，最多 100 条".into(),
        ));
    }
    let mut models = std::collections::HashSet::new();
    for route in &routes {
        if route.model.trim().is_empty()
            || route.model != route.model.trim()
            || !models.insert(&route.model)
            || route.providers.is_empty()
            || route.providers.len() > 20
        {
            return Err(AppError::InvalidInput(
                "每个模型必须唯一且至少配置一个供应商（最多 20 个）".into(),
            ));
        }
        let mut ids = std::collections::HashSet::new();
        for id in &route.providers {
            if !ids.insert(id) || db.get_provider_by_id(id, app)?.is_none() {
                return Err(AppError::InvalidInput(
                    "线路包含重复或不存在的供应商".into(),
                ));
            }
        }
    }
    db.set_setting(
        &format!("model_routes_{app}"),
        &serde_json::to_string(&routes).map_err(|e| AppError::Message(e.to_string()))?,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_routes_without_overwriting_saved_rules() {
        let db = Database::memory().unwrap();
        assert!(save(
            &db,
            "codex",
            vec![ModelRoute {
                model: "m".into(),
                providers: vec!["missing".into()]
            }]
        )
        .is_err());
        assert!(read(&db, "codex").unwrap().is_empty());
    }
}
