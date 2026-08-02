terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

# Azure Event Hubs Namespace
resource "azurerm_eventhub_namespace" "eh_ns" {
  name                = "ehns-tradeguard-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Standard"
  capacity            = 1
}

# Azure Event Hub
resource "azurerm_eventhub" "eh" {
  name                = "trade-events"
  namespace_name      = azurerm_eventhub_namespace.eh_ns.name
  resource_group_name = azurerm_resource_group.rg.name
  partition_count     = 2
  message_retention   = 1
}

# Azure Service Bus Namespace
resource "azurerm_servicebus_namespace" "sb_ns" {
  name                = "sbns-tradeguard-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Standard"
}

# Azure Service Bus Queue
resource "azurerm_servicebus_queue" "sb_queue" {
  name         = "alerts-queue"
  namespace_id = azurerm_servicebus_namespace.sb_ns.id
}
