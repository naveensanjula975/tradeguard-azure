output "resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "event_hubs_namespace" {
  value = azurerm_eventhub_namespace.eh_ns.name
}

output "service_bus_namespace" {
  value = azurerm_servicebus_namespace.sb_ns.name
}

output "postgresql_server_fqdn" {
  value       = azurerm_postgresql_flexible_server.postgres.fqdn
  description = "Fully qualified domain name of the Azure PostgreSQL Flexible Server"
}

output "key_vault_uri" {
  value       = azurerm_key_vault.kv.vault_uri
  description = "URI of the Azure Key Vault instance"
}

output "container_app_environment_id" {
  value       = azurerm_container_app_environment.cae.id
  description = "Resource ID of the Azure Container Apps Environment"
}

output "frontend_url" {
  value       = "https://${azurerm_container_app.app_frontend.ingress[0].fqdn}"
  description = "Public URL for the TradeGuard Next.js Frontend"
}

output "alert_service_url" {
  value       = "https://${azurerm_container_app.app_alert_case.ingress[0].fqdn}"
  description = "Public API URL for the Alert & Case Management Service"
}

output "ingestion_service_url" {
  value       = "https://${azurerm_container_app.app_ingestion.ingress[0].fqdn}"
  description = "Public API URL for Trade Event Ingestion Service"
}

output "simulator_service_url" {
  value       = "https://${azurerm_container_app.app_simulator.ingress[0].fqdn}"
  description = "Public API URL for the Simulator Service"
}
