import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Users, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const MembershipSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("landing");

  const communityFeatures = [
    t("membership.community.feature1"),
    t("membership.community.feature2"),
    t("membership.community.feature3"),
    t("membership.community.feature4"),
  ];

  const memberFeatures = [
    t("membership.member.feature1"),
    t("membership.member.feature2"),
    t("membership.member.feature3"),
    t("membership.member.feature4"),
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
            {t("membership.badge")}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("membership.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("membership.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="flex flex-col border-2 border-border">
            <CardContent className="flex flex-col h-full p-8">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-foreground">{t("membership.community.name")}</span>
              </div>
              <div className="text-4xl font-bold text-foreground mb-1">{t("membership.community.price")}</div>
              <p className="text-sm text-muted-foreground mb-6">{t("membership.community.priceNote")}</p>

              <ul className="space-y-3 mb-8 flex-1">
                {communityFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button variant="outline" className="w-full" onClick={() => navigate("/join")}>
                {t("membership.community.cta")}
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col border-2 border-primary relative shadow-elegant">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-4 py-1">
                {t("membership.member.badge")}
              </Badge>
            </div>
            <CardContent className="flex flex-col h-full p-8">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">{t("membership.member.name")}</span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold text-foreground">{t("membership.member.price")}</span>
                <span className="text-muted-foreground mb-1">{t("membership.member.priceUnit")}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{t("membership.member.priceNote")}</p>

              <ul className="space-y-3 mb-8 flex-1">
                {memberFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button variant="hero" className="w-full group" onClick={() => navigate("/join")}>
                {t("membership.member.cta")}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          {t("membership.socialProof")}
        </p>
      </div>
    </section>
  );
};

export default MembershipSection;
