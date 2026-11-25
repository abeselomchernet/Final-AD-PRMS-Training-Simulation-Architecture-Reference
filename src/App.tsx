import React, { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { PrmsProvider, usePrms } from './context/PrmsContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { TenantMobileApp } from './components/mobile/TenantMobileApp';
import { OwnerMobileApp } from './components/mobile/OwnerMobileApp';
import { GovernanceCallout } from './components/ui/Primitives';
import { getModuleAccess } from './policies/rbac';
import { biText } from './data/i18n';
import { NavSection } from './types/prms';

const ExecutiveDashboard = lazy(() =>
  import('./pages/ExecutiveDashboard').then((m) => ({ default: m.ExecutiveDashboard }))
);
const OwnersEntitiesPage = lazy(() =>
  import('./pages/OwnersEntitiesPage').then((m) => ({ default: m.OwnersEntitiesPage }))
);
const PropertyPortfolioPage = lazy(() =>
  import('./pages/PropertyPortfolioPage').then((m) => ({ default: m.PropertyPortfolioPage }))
);
const RentalApplicationsPage = lazy(() =>
  import('./pages/RentalApplicationsPage').then((m) => ({ default: m.RentalApplicationsPage }))
);
const TenantsLeasesPage = lazy(() =>
  import('./pages/TenantsLeasesPage').then((m) => ({ default: m.TenantsLeasesPage }))
);
const RentCollectionsPage = lazy(() =>
  import('./pages/RentCollectionsPage').then((m) => ({ default: m.RentCollectionsPage }))
);
const ExpensesPayablesPage = lazy(() =>
  import('./pages/ExpensesPayablesPage').then((m) => ({ default: m.ExpensesPayablesPage }))
);
const MaintenanceComplaintsPage = lazy(() =>
  import('./pages/MaintenanceComplaintsPage').then((m) => ({ default: m.MaintenanceComplaintsPage }))
);
const FinancePage = lazy(() =>
  import('./pages/FinancePage').then((m) => ({ default: m.FinancePage }))
);
const TaxConfigurationPage = lazy(() =>
  import('./pages/TaxConfigurationPage').then((m) => ({ default: m.TaxConfigurationPage }))
);
const ComplianceReadinessPage = lazy(() =>
  import('./pages/ComplianceReadinessPage').then((m) => ({ default: m.ComplianceReadinessPage }))
);
const ApprovalsCentrePage = lazy(() =>
  import('./pages/ApprovalsCentrePage').then((m) => ({ default: m.ApprovalsCentrePage }))
);
const AuditTrailPage = lazy(() =>
  import('./pages/AuditTrailPage').then((m) => ({ default: m.AuditTrailPage }))
);
const AdministrationPage = lazy(() =>
  import('./pages/AdministrationPage').then((m) => ({ default: m.AdministrationPage }))
);
const BackupRecoveryPage = lazy(() =>
  import('./pages/BackupRecoveryPage').then((m) => ({ default: m.BackupRecoveryPage }))
);
const MigrationReadinessPage = lazy(() =>
  import('./pages/MigrationReadinessPage').then((m) => ({ default: m.MigrationReadinessPage }))
);
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const RequirementsAcceptancePage = lazy(() =>
  import('./pages/RequirementsAcceptancePage').then((m) => ({ default: m.RequirementsAcceptancePage }))
);
const TrainingExercisesPage = lazy(() =>
  import('./pages/TrainingExercisesPage').then((m) => ({ default: m.TrainingExercisesPage }))
);
const SystemDemonstrationPage = lazy(() =>
  import('./pages/SystemDemonstrationPage').then((m) => ({ default: m.SystemDemonstrationPage }))
);
const ProductionSecurityArchitecturePage = lazy(() =>
  import('./pages/ProductionSecurityArchitecturePage').then((m) => ({
    default: m.ProductionSecurityArchitecturePage,
  }))
);
const VisualQaPage = lazy(() =>
  import('./pages/VisualQaPage').then((m) => ({ default: m.VisualQaPage }))
);
const GovernanceBoundariesPage = lazy(() =>
  import('./pages/GovernanceBoundariesPage').then((m) => ({ default: m.GovernanceBoundariesPage }))
);
const OAuthConsentPage = lazy(() =>
  import('./pages/OAuthConsentPage').then((m) => ({ default: m.OAuthConsentPage }))
);

const SECTION_LABEL_KEYS: Record<NavSection, string> = {
  dashboard: 'navDashboard',
  owners: 'navOwners',
  portfolio: 'navPortfolio',
  'rental-applications': 'navRentalApplications',
  'tenants-leases': 'navTenantsLeases',
  collections: 'navCollections',
  expenses: 'navExpenses',
  maintenance: 'navMaintenance',
  finance: 'navFinance',
  tax: 'navTax',
  compliance: 'navCompliance',
  approvals: 'navApprovals',
  audit: 'navAudit',
  admin: 'navAdmin',
  'backup-recovery': 'navBackupRecovery',
  migration: 'navMigration',
  reports: 'navReports',
  'requirements-acceptance': 'navRequirementsAcceptance',
  'training-exercises': 'navTrainingExercises',
  'system-demonstration': 'navSystemDemonstration',
  'security-architecture': 'navSecurityArchitecture',
  'visual-qa': 'navVisualQa',
  governance: 'navGovernance',
};

const ActiveWorkspace: React.FC = () => {
  const {
    isAuthenticated,
    isTenantAuthenticated,
    mobileMode,
    activeSection,
    setActiveSection,
    currentPersona,
    locale,
    labels,
  } = usePrms();

  if (isTenantAuthenticated) {
    return <TenantMobileApp />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const moduleAccess = getModuleAccess(currentPersona.role, activeSection);

  const renderSection = () => {
    if (!moduleAccess.enabled) {
      return (
        <GovernanceCallout
          variant="restricted"
          controlType="Production Boundary"
          title={biText(
            locale,
            `Module Restricted for ${currentPersona.role}`,
            `ይህ ክፍል ለ ${currentPersona.role} የተገደበ ነው`
          )}
          description={
            moduleAccess.reason ||
            biText(
              locale,
              'Your fixed training session role does not permit access to this module.',
              'የእርስዎ ቋሚ የሥልጠና ሚና ወደዚህ ክፍል መግባት አይፈቅድም።'
            )
          }
          action={
            <button
              type="button"
              onClick={() => setActiveSection('dashboard')}
              className="px-3.5 py-2 rounded-md bg-[#0F233A] dark:bg-[#248F64] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              {biText(locale, 'Return to Home Workspace', 'ወደ መነሻ ገጽ ተመለስ')}
            </button>
          }
        />
      );
    }

    switch (activeSection) {
      case 'dashboard':
        return <ExecutiveDashboard />;
      case 'owners':
        return <OwnersEntitiesPage />;
      case 'portfolio':
        return <PropertyPortfolioPage />;
      case 'rental-applications':
        return <RentalApplicationsPage />;
      case 'tenants-leases':
        return <TenantsLeasesPage />;
      case 'collections':
        return <RentCollectionsPage />;
      case 'expenses':
        return <ExpensesPayablesPage />;
      case 'maintenance':
        return <MaintenanceComplaintsPage />;
      case 'finance':
        return <FinancePage />;
      case 'tax':
        return <TaxConfigurationPage />;
      case 'compliance':
        return <ComplianceReadinessPage />;
      case 'approvals':
        return <ApprovalsCentrePage />;
      case 'audit':
        return <AuditTrailPage />;
      case 'admin':
        return <AdministrationPage />;
      case 'backup-recovery':
        return <BackupRecoveryPage />;
      case 'migration':
        return <MigrationReadinessPage />;
      case 'reports':
        return <ReportsPage />;
      case 'requirements-acceptance':
        return <RequirementsAcceptancePage />;
      case 'training-exercises':
        return <TrainingExercisesPage />;
      case 'system-demonstration':
        return <SystemDemonstrationPage />;
      case 'security-architecture':
        return <ProductionSecurityArchitecturePage />;
      case 'visual-qa':
        return <VisualQaPage />;
      case 'governance':
        return <GovernanceBoundariesPage />;
      default:
        return <ExecutiveDashboard />;
    }
  };

  const renderActiveModule = () => (
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#111C2C] p-6 text-xs text-slate-600 dark:text-slate-300"
        >
          {biText(locale, 'Loading workspace module…', 'የሥራ ክፍል በመጫን ላይ…')}
        </div>
      }
    >
      {renderSection()}
    </Suspense>
  );

  if (mobileMode === 'owner-mobile') {
    return <OwnerMobileApp renderActiveModule={renderActiveModule} />;
  }

  return (
    <AppShell
      pageTitle={labels[SECTION_LABEL_KEYS[activeSection]] || labels.navDashboard}
      contextualActions={
        activeSection !== 'governance' ? (
          <button
            type="button"
            onClick={() => setActiveSection('governance')}
            className="px-3 py-1.5 rounded-md border border-[#DFE5EE] dark:border-[#233349] bg-white dark:bg-[#162438] hover:bg-slate-50 dark:hover:bg-[#1D2E47] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {labels.prototypeBoundariesBtn}
          </button>
        ) : null
      }
    >
      {renderActiveModule()}
    </AppShell>
  );
};

export default function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isOAuthConsentRoute =
    pathname === '/oauth/consent' || pathname === '/oauth/consent/';

  return (
    <ErrorBoundary>
      <ThemeProvider>
        {isOAuthConsentRoute ? (
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center text-xs text-slate-500">
                Loading OAuth 2.1 consent view…
              </div>
            }
          >
            <OAuthConsentPage />
          </Suspense>
        ) : (
          <PrmsProvider>
            <ActiveWorkspace />
          </PrmsProvider>
        )}
      </ThemeProvider>
    </ErrorBoundary>
  );
}
