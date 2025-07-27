import { Prisma } from '@prisma/client'

// Type definitions
export interface FieldConfig {
  fieldName: string
  columnName?: string
  format?: (value: any) => any
  includeInExport?: boolean
  isRelation?: boolean
  relationFields?: string[]
}

export interface ExportConfig {
  modelName: string
  fields?: FieldConfig[]
  includeRelations?: string[]
  excludeFields?: string[]
  defaultFormatters?: {
    DateTime?: (value: Date) => string
    Boolean?: (value: boolean) => string
    Decimal?: (value: any) => string
    Json?: (value: any) => string
  }
}

// Default formatters for common data types
const defaultFormatters = {
  DateTime: (value: Date | null) => 
    value ? new Date(value).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }) : '',
  Boolean: (value: boolean) => value ? 'Yes' : 'No',
  Decimal: (value: any) => value?.toString() || '0',
  Json: (value: any) => value ? JSON.stringify(value) : '',
}

// Get model fields from Prisma DMMF
export function getModelFields(modelName: string): readonly Prisma.DMMF.Field[] {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName)
  if (!model) {
    throw new Error(`Model ${modelName} not found in Prisma schema`)
  }
  return model.fields as readonly Prisma.DMMF.Field[]
}

// Convert field name to display column name
export function fieldToColumnName(fieldName: string): string {
  // Convert camelCase to Title Case
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Id$/, 'ID')
    .replace(/^Is /, '')
    .trim()
}

// Generate export configuration from Prisma model
export function generateExportConfig(
  modelName: string, 
  customConfig?: Partial<ExportConfig>
): FieldConfig[] {
  const fields = getModelFields(modelName)
  const excludeFields = customConfig?.excludeFields || []
  const fieldOverrides = customConfig?.fields || []
  
  const fieldConfigs: FieldConfig[] = []
  
  for (const field of fields) {
    // Skip excluded fields
    if (excludeFields.includes(field.name)) continue
    
    // Skip relation fields unless specifically included
    if (field.kind === 'object' && !customConfig?.includeRelations?.includes(field.name)) continue
    
    // Check for custom configuration
    const customField = fieldOverrides.find(f => f.fieldName === field.name)
    
    // Build field configuration
    const fieldConfig: FieldConfig = {
      fieldName: field.name,
      columnName: customField?.columnName || fieldToColumnName(field.name),
      includeInExport: customField?.includeInExport !== false,
    }
    
    // Add formatter based on field type
    if (!customField?.format) {
      const formatters = { ...defaultFormatters, ...customConfig?.defaultFormatters }
      
      if (field.type === 'DateTime') {
        fieldConfig.format = formatters.DateTime
      } else if (field.type === 'Boolean') {
        fieldConfig.format = formatters.Boolean
      } else if (field.type === 'Decimal') {
        fieldConfig.format = formatters.Decimal
      } else if (field.type === 'Json') {
        fieldConfig.format = formatters.Json
      } else {
        // Default format for other types
        fieldConfig.format = (value: any) => value?.toString() || ''
      }
    } else {
      fieldConfig.format = customField.format
    }
    
    fieldConfigs.push(fieldConfig)
  }
  
  // Add custom fields for relations
  if (customConfig?.fields) {
    const relationFields = customConfig.fields.filter(f => f.isRelation)
    fieldConfigs.push(...relationFields)
  }
  
  return fieldConfigs.filter(f => f.includeInExport !== false)
}

// Apply export configuration to data
export function applyExportConfig(
  data: any[], 
  fieldConfigs: FieldConfig[]
): Record<string, any>[] {
  return data.map(record => {
    const row: Record<string, any> = {}
    
    for (const config of fieldConfigs) {
      const value = config.isRelation 
        ? getNestedValue(record, config.fieldName)
        : record[config.fieldName]
      
      row[config.columnName || config.fieldName] = config.format 
        ? config.format(value)
        : value
    }
    
    return row
  })
}

// Get nested value from object (e.g., 'warehouse.name')
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// Specific configurations for common models
export const inventoryTransactionExportConfig: Partial<ExportConfig> = {
  modelName: 'InventoryTransaction',
  excludeFields: ['id', 'warehouseId', 'skuId', 'createdById'],
  includeRelations: ['warehouse', 'sku', 'createdBy'],
  fields: [
    // Override default column names
    { fieldName: 'transactionId', columnName: 'Transaction ID' },
    { fieldName: 'transactionType', columnName: 'Type' },
    { fieldName: 'pickupDate', columnName: 'Pickup Date' },
    { fieldName: 'isReconciled', columnName: 'Is Reconciled' },
    { fieldName: 'trackingNumber', columnName: 'Tracking Number' },
    
    // Add relation fields
    { 
      fieldName: 'warehouse.name', 
      columnName: 'Warehouse',
      isRelation: true,
      format: (value) => value || ''
    },
    { 
      fieldName: 'sku.skuCode', 
      columnName: 'SKU Code',
      isRelation: true,
      format: (value) => value || ''
    },
    { 
      fieldName: 'sku.description', 
      columnName: 'SKU Description',
      isRelation: true,
      format: (value) => value || ''
    },
    { 
      fieldName: 'createdBy.fullName', 
      columnName: 'Created By',
      isRelation: true,
      format: (value) => value || ''
    },
    
    // Special formatting
    {
      fieldName: 'attachments',
      columnName: 'Attachments',
      format: (value) => {
        if (!value) return ''
        const attachments = value as any
        const types = []
        if (attachments.packingList) types.push('Packing List')
        if (attachments.commercialInvoice) types.push('Invoice')
        if (attachments.deliveryNote) types.push('Delivery Note')
        return types.join(', ')
      }
    }
  ]
}

// Generate Excel export with dynamic fields
export function generateExcelExport(
  data: any[],
  sheetName: string,
  exportConfig: Partial<ExportConfig>
): ArrayBuffer {
  const XLSX = require('xlsx')
  
  // Generate field configuration
  const fieldConfigs = generateExportConfig(exportConfig.modelName!, exportConfig)
  
  // Apply configuration to data
  const exportData = applyExportConfig(data, fieldConfigs)
  
  // Create workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(exportData)
  
  // Auto-size columns based on content
  const colWidths = Object.keys(exportData[0] || {}).map(key => ({
    wch: Math.max(
      key.length,
      ...exportData.map(row => String(row[key] || '').length)
    ) + 2
  }))
  ws['!cols'] = colWidths
  
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  
  // Generate buffer
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}