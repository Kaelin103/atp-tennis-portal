# Install jsonlite if not installed (this might fail if no internet/permissions, but user said "install.packages")
if (!require("jsonlite")) install.packages("jsonlite", repos = "http://cran.us.r-project.org")
library(jsonlite)

# Set working directory to project root (adjust if needed, but script is running here)
setwd("C:/Projects/atp-tennis-portal")

# Check if model exists
if (!file.exists("models/m_interact.rds")) {
  stop("Model file models/m_interact.rds not found!")
}

m_interact <- readRDS("models/m_interact.rds")
coefs <- coef(m_interact)

model_json <- list(
  model_name = "logistic_time_aware_interact",
  features = c("dRank", "dDecay", "dRank:dDecay"),
  intercept = unname(coefs["(Intercept)"]),
  beta_dRank = unname(coefs["dRank"]),
  beta_dDecay = unname(coefs["dDecay"]),
  beta_interaction = unname(coefs["dRank:dDecay"])
)

write_json(model_json, "models/m_interact.json", pretty = TRUE, auto_unbox = TRUE)
print("Model exported successfully to models/m_interact.json")
