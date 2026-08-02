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
  description = "Deployment environment name"
}
