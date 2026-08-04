export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
  };
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: User;
}
