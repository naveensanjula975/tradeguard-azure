terraform {
  backend "azurerm" {
    # These values must be supplied at init time via -backend-config or environment variables.
    # Do NOT hardcode subscription_id, storage_account_name, etc. here.
    #
    # Usage:
    #   terraform init \
    #     -backend-config="resource_group_name=rg-tradeguard-tfstate" \
    #     -backend-config="storage_account_name=sttradeguardtfstate" \
    #     -backend-config="container_name=tfstate" \
    #     -backend-config="key=tradeguard-<environment>.tfstate"
    #
    # Or export ARM_* environment variables (preferred for CI):
    #   export ARM_SUBSCRIPTION_ID=...
    #   export ARM_TENANT_ID=...
    #   export ARM_CLIENT_ID=...
    #   export ARM_CLIENT_SECRET=...

    resource_group_name  = ""  # Override via -backend-config
    storage_account_name = ""  # Override via -backend-config
    container_name       = "tfstate"
    key                  = "tradeguard.tfstate"

    # State locking is provided natively via Azure Blob leases (no DynamoDB needed)
    use_azuread_auth = true  # Prefer Entra ID over storage access keys
  }
}

# ─────────────────────────────────────────────────────────
# Backend provisioning instructions:
#
# Run ONCE per Azure subscription to create the state backend:
#   az group create --name rg-tradeguard-tfstate --location eastus
#
#   az storage account create \
#     --name sttradeguardtfstate \
#     --resource-group rg-tradeguard-tfstate \
#     --sku Standard_LRS \
#     --kind StorageV2 \
#     --allow-blob-public-access false \
#     --min-tls-version TLS1_2
#
#   az storage container create \
#     --name tfstate \
#     --account-name sttradeguardtfstate
#
#   # Enable versioning for state history & recovery
#   az storage account blob-service-properties update \
#     --account-name sttradeguardtfstate \
#     --enable-versioning true
# ─────────────────────────────────────────────────────────
