import { Tags, Award, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useOrdersInRange, useCategoryBreakdown, useTopSellingProducts } from '@/hooks/useDashboardData';
import { topBrandsFromOrders } from '@/services/sellerStatsService';
import { SalesLast7DaysChart, SalesLast30DaysChart, MonthlyRevenueChart } from './charts/SalesTrendChart';
import { OrderStatusPie } from './charts/OrderStatusPie';
import { RankedBarChart } from './charts/RankedBarChart';
import { CustomerGrowthChart, SellerGrowthChart } from './charts/GrowthCharts';

interface SalesAnalyticsSectionProps {
  sellerId: string;
  isHeadSeller: boolean;
}

/** The Recharts-powered analytics section — lazy-loaded from SellerDashboardPage so the recharts
 *  bundle never delays first paint of the rest of the dashboard. */
export default function SalesAnalyticsSection({ sellerId, isHeadSeller }: SalesAnalyticsSectionProps) {
  const ordersIn30Days = useOrdersInRange(sellerId, isHeadSeller, 30);
  const categoryBreakdown = useCategoryBreakdown(sellerId, isHeadSeller);
  const topSelling = useTopSellingProducts(sellerId, isHeadSeller);

  const topBrands = ordersIn30Days.data ? topBrandsFromOrders(ordersIn30Days.data, 8) : undefined;

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Analytics</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SalesLast7DaysChart sellerId={sellerId} isHeadSeller={isHeadSeller} />
        <SalesLast30DaysChart sellerId={sellerId} isHeadSeller={isHeadSeller} />
        <MonthlyRevenueChart sellerId={sellerId} isHeadSeller={isHeadSeller} />
        <OrderStatusPie sellerId={sellerId} isHeadSeller={isHeadSeller} />

        <RankedBarChart
          title="Top Categories"
          icon={Tags}
          isLoading={categoryBreakdown.isLoading}
          data={categoryBreakdown.data?.map((c) => ({ name: c.category_name, value: c.units_sold }))}
          emptyLabel="No sales yet to break down by category."
        />
        <RankedBarChart
          title="Revenue by Category"
          icon={TrendingUp}
          isLoading={categoryBreakdown.isLoading}
          data={categoryBreakdown.data?.map((c) => ({ name: c.category_name, value: c.revenue }))}
          valueFormatter={formatCurrency}
          emptyLabel="No sales yet to break down by category."
        />
        <RankedBarChart
          title="Top Brands (30 days)"
          icon={Award}
          isLoading={ordersIn30Days.isLoading}
          data={topBrands?.map((b) => ({ name: b.brand_name, value: b.revenue }))}
          valueFormatter={formatCurrency}
          emptyLabel="No sales in the last 30 days."
        />
        <RankedBarChart
          title="Best Selling Products"
          icon={Award}
          isLoading={topSelling.isLoading}
          data={topSelling.data?.map((p) => ({ name: p.product_name, value: p.units_sold }))}
          emptyLabel="No sales yet."
        />

        {isHeadSeller && (
          <>
            <CustomerGrowthChart enabled={isHeadSeller} />
            <SellerGrowthChart enabled={isHeadSeller} />
          </>
        )}
      </div>
    </section>
  );
}
