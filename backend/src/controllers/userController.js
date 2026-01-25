import { User } from "../models/User.js";

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("❌ getProfile error:", err);
    res.status(500).json({ message: "Failed to fetch profile", error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, country, avatar } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, country, avatar },
      { new: true, runValidators: true }
    ).select("-password");
    res.json({ message: "Profile updated successfully", user: updated });
  } catch (err) {
    console.error("❌ updateProfile error:", err);
    res.status(500).json({ message: "Failed to update profile", error: err.message });
  }
};
