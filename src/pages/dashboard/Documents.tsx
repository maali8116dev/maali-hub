import { MemberFeatureGate } from "@/components/MemberFeatureGate";
import { UserDocumentLibrary } from "@/components/dashboard/UserDocumentLibrary";

const Documents = () => (
  <MemberFeatureGate>
    <UserDocumentLibrary />
  </MemberFeatureGate>
);

export default Documents;
