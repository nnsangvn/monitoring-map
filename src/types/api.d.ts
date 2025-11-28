export interface SalesMan {
  id: number;
  code: string;
  user_id: number;
  phone: string;
  name: string;
  lat: null | string;
  long: null | string;
  device_name: null | string;
  avatar: null | string;
  area: null;
  channels: null;
  sales_position: null | string;
  is_parent: number;
  count_child: number;
  created_at: string;
  updated_at: string;
  time_diff: null | string;
  is_online: number;
  total_sale: number;
  total_sale_formatted: string;
  total_sale_day_formatted: string;
  total_sale_completed: number;
  total_sale__completed_formatted: string;
  order_count: number;
  order_count_day: number;
  total_visit_day: number;
  type: string;
}

export interface ApiResponse<T> {
  data: T[];
  meta: {
    pagination: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
      links: Record<string, unknown>;
    };
  };
}
