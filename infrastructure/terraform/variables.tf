variable "resource_group_name" {
  type        = string
  default     = "rg-tradeguard-mvp"
  description = "Name of the Azure Resource Group"
}

variable "location" {
  type        = string
  default     = "eastus"
  description = "Azure region for deployment"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Deployment environment name (dev, staging, prod)"
}

variable "tenant_id" {
  type        = string
  default     = ""
  description = "Azure AD Tenant ID for Key Vault access policies"
}

variable "db_admin_username" {
  type        = string
  default     = "postgres"
  description = "Administrator username for PostgreSQL Flexible Server"
}

variable "db_admin_password" {
  type        = string
  default     = "SecureP@ssw0rd2026!"
  sensitive   = true
  description = "Administrator password for PostgreSQL Flexible Server"
}
