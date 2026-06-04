import { Schema, model } from "mongoose";

export interface JobLockDoc {
  key: string;
  owner: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const jobLockSchema = new Schema<JobLockDoc>(
  {
    key: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

export const JobLock = model<JobLockDoc>("JobLock", jobLockSchema);
