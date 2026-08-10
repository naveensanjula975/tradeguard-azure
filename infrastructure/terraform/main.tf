terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5.0"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = true
    }
  }
}

resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

# Random suffix for globally unique resource names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# 1. Azure Key Vault
resource "azurerm_key_vault" "kv" {
  name                        = "kv-tradeguard-${var.environment}-${random_string.suffix.result}"
  location                    = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  enabled_for_disk_encryption = true
  tenant_id                   = var.tenant_id != "" ? var.tenant_id : "00000000-0000-0000-0000-000000000000"
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  sku_name                    = "standard"
}

# 2. Azure PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "postgres" {
  name                   = "psql-tradeguard-${var.environment}-${random_string.suffix.result}"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "16"
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  zone                   = "1"
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
}

resource "azurerm_postgresql_flexible_server_database" "db" {
  name      = "tradeguard"
  server_id = azurerm_postgresql_flexible_server.postgres.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Firewall rule allowing Azure internal traffic to PostgreSQL
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.postgres.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# 3. Azure Event Hubs Namespace & Event Hub
resource "azurerm_eventhub_namespace" "eh_ns" {
  name                = "ehns-tradeguard-${var.environment}-${random_string.suffix.result}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Standard"
  capacity            = 1
}

resource "azurerm_eventhub" "eh" {
  name                = "trade-events"
  namespace_name      = azurerm_eventhub_namespace.eh_ns.name
  resource_group_name = azurerm_resource_group.rg.name
  partition_count     = 2
  message_retention   = 1
}

# 4. Azure Service Bus Namespace & Queue
resource "azurerm_servicebus_namespace" "sb_ns" {
  name                = "sbns-tradeguard-${var.environment}-${random_string.suffix.result}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Standard"
}

resource "azurerm_servicebus_queue" "sb_queue" {
  name         = "alerts-queue"
  namespace_id = azurerm_servicebus_namespace.sb_ns.id
}

# 5. Azure Container Apps Environment
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "log-tradeguard-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "cae" {
  name                       = "cae-tradeguard-${var.environment}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
}

# 6. Azure Container Apps for Microservices

# 6a. Anomaly Service
resource "azurerm_container_app" "app_anomaly" {
  name                         = "ca-anomaly-service"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  template {
    container {
      name   = "anomaly-service"
      image  = "ghcr.io/tradeguard/anomaly-service:latest"
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "PORT"
        value = "8002"
      }
      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
    }
  }

  ingress {
    external_enabled = false
    target_port      = 8002
    transport        = "auto"
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# 6b. Alert & Case Service
resource "azurerm_container_app" "app_alert_case" {
  name                         = "ca-alert-case-service"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  template {
    container {
      name   = "alert-case-service"
      image  = "ghcr.io/tradeguard/alert-case-service:latest"
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "PORT"
        value = "8003"
      }
      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
      env {
        name  = "DATABASE_URL"
        value = "postgresql+psycopg2://${var.db_admin_username}:${var.db_admin_password}@${azurerm_postgresql_flexible_server.postgres.fqdn}:5432/tradeguard"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8003
    transport        = "auto"
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# 6c. Risk Engine
resource "azurerm_container_app" "app_risk_engine" {
  name                         = "ca-risk-engine"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  template {
    container {
      name   = "risk-engine"
      image  = "ghcr.io/tradeguard/risk-engine:latest"
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "PORT"
        value = "8005"
      }
      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
      env {
        name  = "ANOMALY_SERVICE_URL"
        value = "http://${azurerm_container_app.app_anomaly.name}:8002"
      }
      env {
        name  = "ALERT_CASE_SERVICE_URL"
        value = "http://${azurerm_container_app.app_alert_case.name}:8003"
      }
    }
  }

  ingress {
    external_enabled = false
    target_port      = 8005
    transport        = "auto"
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# 6d. Ingestion Service
resource "azurerm_container_app" "app_ingestion" {
  name                         = "ca-ingestion-service"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  template {
    container {
      name   = "ingestion-service"
      image  = "ghcr.io/tradeguard/ingestion-service:latest"
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "PORT"
        value = "8001"
      }
      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
      env {
        name  = "DATABASE_URL"
        value = "postgresql+psycopg2://${var.db_admin_username}:${var.db_admin_password}@${azurerm_postgresql_flexible_server.postgres.fqdn}:5432/tradeguard"
      }
      env {
        name  = "RISK_ENGINE_URL"
        value = "http://${azurerm_container_app.app_risk_engine.name}:8005"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8001
    transport        = "auto"
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# 6e. Simulator Service
resource "azurerm_container_app" "app_simulator" {
  name                         = "ca-simulator"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  template {
    container {
      name   = "simulator"
      image  = "ghcr.io/tradeguard/simulator:latest"
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "PORT"
        value = "8004"
      }
      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
      env {
        name  = "INGESTION_SERVICE_URL"
        value = "http://${azurerm_container_app.app_ingestion.name}:8001"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8004
    transport        = "auto"
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# 6f. Frontend Web App
resource "azurerm_container_app" "app_frontend" {
  name                         = "ca-frontend"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  template {
    container {
      name   = "frontend"
      image  = "ghcr.io/tradeguard/frontend:latest"
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "https://${azurerm_container_app.app_alert_case.ingress[0].fqdn}"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "auto"
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}
