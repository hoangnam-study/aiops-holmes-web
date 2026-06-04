import { Schema, model } from "mongoose";

export interface UserDoc {
  email: string;
  passwordHash: string;
  role: "admin" | "operator" | "viewer";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "operator", "viewer"], default: "viewer", index: true }
  },
  { timestamps: true }
);

export const User = model<UserDoc>("User", userSchema);
