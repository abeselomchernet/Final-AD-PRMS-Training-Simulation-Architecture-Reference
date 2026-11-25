import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { usePrms } from '../../context/PrmsContext';
import { biText } from '../../data/i18n';
import { getModuleAccess } from '../../policies/rbac';
import { NavSection, PersonaRole } from '../../types/prms';
import { GovernanceCallout } from '../ui/Primitives';

interface RequireAuthProps {
  section?: NavSection;
  allowedRoles?: PersonaRole[];
  children: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({
  section,
  allowedRoles,
  children,
}) => {
  const {
    isAuthenticated,
    isTenantAuthenticated,
    currentPersona,
    setActiveSection,
    logoutToLogin,
    locale,
  } = usePrms();

  if (!isAuthenticated || isTenantAuthenticated) {
    return (
      <div className="p-6" data-testid="require-auth-denied">
        <GovernanceCallout
          variant="restricted"
          controlType="Production Boundary"
          title={biText(
            locale,
            '401 Authentication Required',
            '401 የሰራተኛ መለያ ማረጋገጫ ያስፈልጋል'
          )}
          description={biText(
            locale,
            'Direct access to protected financial or security pages requires an authenticated staff session.',
            'ወደተጠበቁ የፋይናንስና የደህንነት ገጾች በቀጥታ ለመግባት የተረጋገጠ የሰራተኛ ክፍለ-ጊዜ ያስፈልጋል።'
          )}
          action={
            <button
              type="button"
              onClick={logoutToLogin}
              className="px-3.5 py-2 rounded-md bg-[#0F233A] text-white text-xs font-semibold cursor-pointer"
            >
              {biText(locale, 'Return to Login', 'ወደ መግቢያ ገጽ ተመለስ')}
            </button>
          }
        />
      </div>
    );
  }

  const sectionAccess = section ? getModuleAccess(currentPersona.role, section) : null;
  const roleAllowed = allowedRoles ? allowedRoles.includes(currentPersona.role) : true;

  if ((sectionAccess && !sectionAccess.enabled) || !roleAllowed) {
    return (
      <div className="p-6" data-testid="require-role-denied">
        <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
          <ShieldAlert className="w-4 h-4" />
          <span>403 · {currentPersona.role}</span>
        </div>
        <GovernanceCallout
          variant="restricted"
          controlType="Production Boundary"
          title={biText(
            locale,
            `Access Restricted for ${currentPersona.role}`,
            `ይህ ክፍል ለ ${currentPersona.role} የተገደበ ነው`
          )}
          description={
            sectionAccess?.reason ||
            biText(
              locale,
              'Your current session role is not authorized to view this protected module.',
              'አሁን ያለዎት ሚና ይህን የተጠበቀ ክፍል እንዲከፍት አልተፈቀደለትም።'
            )
          }
          action={
            <button
              type="button"
              onClick={() => setActiveSection('dashboard')}
              className="px-3.5 py-2 rounded-md bg-[#0F233A] dark:bg-[#248F64] text-white text-xs font-semibold cursor-pointer"
            >
              {biText(locale, 'Return to Home Workspace', 'ወደ መነሻ ገጽ ተመለስ')}
            </button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
};
