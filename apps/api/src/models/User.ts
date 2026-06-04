import { Schema, model } from "mongoose";

export interface UserDoc {
  email: string;
  passwordHash: string;
  role: "admin";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin"], default: "admin" }
  },
  { timestamps: true }
);

export const User = model<UserDoc>("User", userSchema);
