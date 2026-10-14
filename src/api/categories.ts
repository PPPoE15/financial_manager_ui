import { http } from '@/api/client'
import type { TransactionType } from '@/types/budget'
import type { Category, CategoryCreate, CategoryList } from '@/types/category'

/** Лимит статей на пользователя по контракту (`FM-409103`): одна страница этого размера вмещает все. */
export const MAX_CATEGORIES = 100

/** `GET /transaction/categories?category_type=` — все статьи типа, отсортированные по названию. */
export async function listCategories(categoryType: TransactionType): Promise<Category[]> {
  const { data } = await http.get<CategoryList>('/categories', {
    params: { category_type: categoryType, limit: MAX_CATEGORIES },
  })
  return data.content
}

/** `POST /transaction/categories` — создаёт статью; 409 `FM-409101` — дубликат, `FM-409103` — лимит. */
export async function createCategory(body: CategoryCreate): Promise<Category> {
  const { data } = await http.post<Category>('/categories', body)
  return data
}
