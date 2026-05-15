import { z } from 'zod'

export const zId = z.string().uuid()
export const zShortText = z.string().max(255)
export const zLongText = z.string().max(2048)
export const zColor = z.string().max(50)
export const zDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const zStandardArray = <T extends z.ZodTypeAny>(schema: T) => z.array(schema).max(100)
export const zPassword = z.string().min(8).max(72)
export const zLoginPassword = z.string().min(1).max(72)
