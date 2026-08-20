import { Link } from "react-router-dom";

import { AlertCircle } from "lucide-react";

import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { usePartnerOrgLinked } from "@/hooks/usePartnerOrg";



export function PartnerOrgRequiredAlert() {

  const { t } = useTranslation("dashboard");

  const { isLinked, isLoading } = usePartnerOrgLinked();



  if (isLoading || isLinked) return null;



  return (

    <Alert variant="destructive">

      <AlertCircle className="h-4 w-4" />

      <AlertTitle>{t("partner.orgNotLinked.title")}</AlertTitle>

      <AlertDescription className="space-y-2">

        <p>{t("partner.orgNotLinked.description")}</p>

        <p>

          <Link to="/contact" className="font-medium underline underline-offset-4">

            {t("partner.orgNotLinked.contactSupport")}

          </Link>

        </p>

      </AlertDescription>

    </Alert>

  );

}

