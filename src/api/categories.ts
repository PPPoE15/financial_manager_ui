import { http } from '@/api/client'
import type { TransactionType } from '@/types/budget'
import type { Category, CategoryCreate, CategoryList, CategoryUpdate } from '@/types/category'

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

/**
 * `PATCH /transaction/categories/{uid}` — меняет только переданные поля (`null` очищает план и комментарий);
 * 404 — статьи нет (удалена), 409 `FM-409101` — дубликат.
 */
export async function updateCategory(uid: string, body: CategoryUpdate): Promise<Category> {
  const { data } = await http.patch<Category>(`/categories/${encodeURIComponent(uid)}`, body)
  return data
}
