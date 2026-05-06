export type LoginRequest = {
  email: string
  password: string
}

export type AuthResponse = {
  accessToken: string
  refreshToken: string
  tokenType?: string
  userId: string
  email: string
  firstName?: string
  lastName?: string
  role?: string
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  userId: string
  email: string
  role?: string
}

export type SwitchContextRequest = {
  businessId: string
  branchId: string
}

export type SwitchContextResponse = {
  accessToken: string
  refreshToken: string
  tokenType?: string
  userId: string
  email: string
  tenantId: string
  businessId: string
  businessName: string
  branchId: string
  branchName: string
  roleName: string
}
