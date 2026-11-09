export interface PlatformSettingsResult {
  brainInstruction: string;
  representativeInstruction: string;
}

export interface UpdatePlatformSettingsInput {
  brainInstruction: string;
  representativeInstruction: string;
}

export interface AdminUserResult {
  username: string;
  role: string;
  createdAt: string;
}

export interface CurrentUserResult {
  username: string;
  isAdmin: boolean;
}
