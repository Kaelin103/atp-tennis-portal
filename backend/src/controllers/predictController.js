import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Player } from "../models/Player.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load model coefficients once at startup
// Note: In production, you might want to check if file exists or handle errors better
const modelPath = path.resolve(__dirname, "../../../models/m_interact.json");
console.log("Model path:", modelPath);
let model;

try {
  if (fs.existsSync(modelPath)) {
    const fileContent = fs.readFileSync(modelPath, "utf-8");
    model = JSON.parse(fileContent);
  } else {
    console.warn("Model file not found at", modelPath);
    // Fallback or empty model to prevent crash, but prediction will be wrong
    model = {
      intercept: 0,
      beta_dRank: 0,
      beta_dDecay: 0,
      beta_interaction: 0
    };
  }
} catch (error) {
  console.error("Error loading model:", error);
  model = {
    intercept: 0,
    beta_dRank: 0,
    beta_dDecay: 0,
    beta_interaction: 0
  };
}

// sigmoid function
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

export const predictMatch = async (req, res) => {
  try {
    const { playerAId, playerBId } = req.body;

    if (!playerAId || !playerBId) {
      return res.status(400).json({ message: "playerAId and playerBId are required" });
    }

    // 1) Find players from MongoDB
    const [playerA, playerB] = await Promise.all([
      Player.findById(playerAId).lean(),
      Player.findById(playerBId).lean(),
    ]);

    if (!playerA || !playerB) {
      return res.status(404).json({ message: "Player not found" });
    }

    // 2) Check for required fields (rank + decay_score)
    // Using rank and decay_score as per Player model update
    const rankA = playerA.rank;
    const rankB = playerB.rank;
    const decayA = playerA.decay_score;
    const decayB = playerB.decay_score;

    if (
      rankA === undefined || rankA === null ||
      rankB === undefined || rankB === null ||
      decayA === undefined || decayA === null ||
      decayB === undefined || decayB === null
    ) {
      return res.status(400).json({
        message: "Missing required player fields (rank / decay_score). Please check DB schema and data.",
        playerA: { name: playerA.name, rank: rankA, decay: decayA },
        playerB: { name: playerB.name, rank: rankB, decay: decayB }
      });
    }

    // 3) Calculate features
    const dRank = rankB - rankA; // Note: dRank usually means (Rank_B - Rank_A) or similar. 
                                 // If model was trained as (P1 - P2), and higher rank (lower number) is better...
                                 // Let's stick to user's logic: dRank = rankB - rankA
    const dDecay = decayA - decayB;
    const interaction = dRank * dDecay;

    // 4) Logistic regression prediction
    const z = model.intercept + 
              model.beta_dRank * dRank + 
              model.beta_dDecay * dDecay + 
              model.beta_interaction * interaction;
              
    const pAWin = sigmoid(z);

    return res.json({
      model: model.model_name || "loaded_model",
      playerA: {
        id: playerA._id,
        name: `${playerA.firstName} ${playerA.lastName}`,
        rank: rankA,
        decay: decayA
      },
      playerB: {
        id: playerB._id,
        name: `${playerB.firstName} ${playerB.lastName}`,
        rank: rankB,
        decay: decayB
      },
      features: {
        dRank,
        dDecay,
        interaction
      },
      probability: {
        pAWin: Number(pAWin.toFixed(4)),
        pBWin: Number((1 - pAWin).toFixed(4))
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
};
