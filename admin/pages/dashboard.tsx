import { PageContainer } from "@keystone-6/core/admin-ui/components";
import DashboardCobranza from "../components/dashboard/DashboardCobranza";

const DashboardPage: React.FC = () => {
  return (
    <PageContainer header="Dashboard">
      <DashboardCobranza />
    </PageContainer>
  );
};

export default DashboardPage;
