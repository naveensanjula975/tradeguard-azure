output "resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "event_hubs_namespace" {
  value = azurerm_eventhub_namespace.eh_ns.name
}

output "service_bus_namespace" {
  value = azurerm_servicebus_namespace.sb_ns.name
}
