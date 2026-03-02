# train_model.R  (Minimal reproducible training script)
# Output:
#   models/m_decay_only.rds
#   models/m_interact.rds
# Requirement:
#   A training dataset containing:
#     - y (0/1 or factor)
#     - dRank (numeric)
#     - dDecay (numeric)
# You can change 'data_path_candidates' below if your file name differs.

local({
options(stringsAsFactors = FALSE)

# 0) setwd to project root (safe)
project_root <- "C:/Projects/atp-tennis-portal"
setwd(project_root)

# 1) find dataset
data_path_candidates <- c(
  "datasets/tennis_atp/data_ml_full_2024.csv",
  "datasets/tennis_atp/data_ml_full_2024.rds"
)

data_path <- data_path_candidates[file.exists(data_path_candidates)][1]
if (is.na(data_path)) {
  stop("❌ Training dataset not found. Please put your training CSV under /data or /datasets and update data_path_candidates.")
}
cat("✅ Using dataset:", data_path, "\n")

df <- read.csv(data_path)

# 2) validate columns (allow auto-build dDecay)
if (!("dDecay" %in% names(df))) {
  if (!("match_date" %in% names(df))) {
    stop("❌ Missing dDecay, and cannot build it because match_date is absent.")
  }
  df$match_date <- as.Date(df$match_date)
  day_index <- as.numeric(df$match_date - min(df$match_date))
  lambda <- 0.01
  df$dDecay <- exp(lambda * day_index)
  cat("✅ Built dDecay from match_date (lambda=", lambda, ")\n")
}

required_cols <- c("y", "dRank", "dDecay")
missing_cols <- setdiff(required_cols, names(df))
if (length(missing_cols) > 0) {
  stop(paste0("❌ Missing columns: ", paste(missing_cols, collapse = ", "),
              "\nYour dataset must contain y, dRank, dDecay."))
}
# 3) clean / coerce
df <- df[complete.cases(df[, required_cols]), required_cols]

# y can be 0/1, or "A"/"B", etc. Make it binary 0/1 first.
if (is.factor(df$y) || is.character(df$y)) {
  df$y <- as.factor(df$y)
  # If 2 levels, map second level to 1 (positive class)
  if (length(levels(df$y)) != 2) stop("❌ y must have exactly 2 classes.")
  df$y_bin <- as.integer(df$y == levels(df$y)[2])
} else {
  df$y_bin <- as.integer(df$y)
  if (!all(df$y_bin %in% c(0,1))) stop("❌ y must be binary (0/1) or 2-class factor.")
}

df$dRank  <- as.numeric(df$dRank)
df$dDecay <- as.numeric(df$dDecay)

# 4) train models
cat("✅ Training m_decay_only ...\n")
m_decay_only <- glm(y_bin ~ dDecay, data = df, family = binomial)

cat("✅ Training m_interact ...\n")
m_interact <- glm(y_bin ~ dRank + dDecay + dRank:dDecay, data = df, family = binomial)

# 5) save models
dir.create("models", showWarnings = FALSE)
saveRDS(m_decay_only, "models/m_decay_only.rds")
saveRDS(m_interact,   "models/m_interact.rds")

cat("✅ Saved:\n")
cat(" - models/m_decay_only.rds\n")
cat(" - models/m_interact.rds\n")

# 6) quick sanity check
tmp <- data.frame(dRank = 5, dDecay = 2)
p <- predict(m_interact, tmp, type = "response")
cat("✅ Sanity predict(dRank=5,dDecay=2) =", p, "\n")
})