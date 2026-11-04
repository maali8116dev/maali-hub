export type EmailLocale = "en" | "fr" | "pt" | "de";

export function resolveEmailLocale(locale?: string | null): EmailLocale {
  if (!locale) return "en";
  const base = locale.toLowerCase().split("-")[0];
  if (base === "fr" || base === "pt" || base === "de") return base;
  return "en";
}

export interface EmailLabels {
  dear: string;
  bestRegards: string;
  team: string;
  maali: string;
  applicant: string;
  project: string;
  applicationId: string;
  status: string;
  applicationSummary: string;
  submitted: string;
  approved: string;
  rejected: string;
  underReview: string;
  paid: string;
  feedback: string;
  viewApplicationStatus: string;
  viewDetails: string;
  browseOpportunities: string;
  trackApplication: string;
  goToDashboard: string;
  resubmitVerification: string;
  exploreOpportunities: string;
  verifyEmail: string;
  resetPassword: string;
  acceptInvitation: string;
  amount: string;
  date: string;
  invoiceNum: string;
  transactionId: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  subject: string;
  message: string;
  yourMessage: string;
  noMessage: string;
  na: string;
  reasonForRejection: string;
  referenceId: string;
  submissionId: string;
  contactSystem: string;
  pdfAttached: string;
  keepRecords: string;
  paymentQuestions: string;
  respondWithin24h: string;
  newContactSubmission: string;
  notification: string;
  newNotification: string;
}

const LABELS: Record<EmailLocale, EmailLabels> = {
  en: {
    dear: "Dear", bestRegards: "Best regards,", team: "The Maali Team", maali: "Maali", applicant: "Applicant",
    project: "Project", applicationId: "Application ID", status: "Status", applicationSummary: "Application summary",
    submitted: "Submitted", approved: "Approved", rejected: "Rejected", underReview: "Under review", paid: "Paid",
    feedback: "Feedback", viewApplicationStatus: "View Application Status", viewDetails: "View Details",
    browseOpportunities: "Browse Opportunities", trackApplication: "Track Application", goToDashboard: "Go to Dashboard",
    resubmitVerification: "Resubmit Verification", exploreOpportunities: "Explore Opportunities",
    verifyEmail: "Verify Email Address", resetPassword: "Reset Password", acceptInvitation: "Accept Invitation",
    amount: "Amount", date: "Date", invoiceNum: "Invoice #", transactionId: "Transaction ID", name: "Name",
    email: "Email", phone: "Phone", country: "Country", subject: "Subject", message: "Message",
    yourMessage: "Your Message", noMessage: "No message provided", na: "N/A", reasonForRejection: "Reason for rejection",
    referenceId: "Reference ID", submissionId: "Submission ID", contactSystem: "Maali Contact System",
    pdfAttached: "A PDF copy of your receipt is attached to this email.",
    keepRecords: "Please keep this email for your records.",
    paymentQuestions: "If you have any questions about this payment, please contact our support team.",
    respondWithin24h: "Please respond to this inquiry within 24 hours.",
    newContactSubmission: "New Contact Form Submission", notification: "Maali Notification",
    newNotification: "You have a new notification from Maali.",
  },
  fr: {
    dear: "Bonjour", bestRegards: "Cordialement,", team: "L'équipe Maali", maali: "Maali", applicant: "Candidat",
    project: "Projet", applicationId: "ID de candidature", status: "Statut", applicationSummary: "Résumé de la candidature",
    submitted: "Soumise", approved: "Approuvée", rejected: "Refusée", underReview: "En cours d'examen", paid: "Payé",
    feedback: "Commentaires", viewApplicationStatus: "Voir le statut de la candidature", viewDetails: "Voir les détails",
    browseOpportunities: "Parcourir les opportunités", trackApplication: "Suivre la candidature",
    goToDashboard: "Accéder au tableau de bord", resubmitVerification: "Resoumettre la vérification",
    exploreOpportunities: "Explorer les opportunités", verifyEmail: "Vérifier l'adresse e-mail",
    resetPassword: "Réinitialiser le mot de passe", acceptInvitation: "Accepter l'invitation",
    amount: "Montant", date: "Date", invoiceNum: "Facture n°", transactionId: "ID de transaction", name: "Nom",
    email: "E-mail", phone: "Téléphone", country: "Pays", subject: "Objet", message: "Message",
    yourMessage: "Votre message", noMessage: "Aucun message fourni", na: "N/D", reasonForRejection: "Motif du refus",
    referenceId: "ID de référence", submissionId: "ID de soumission", contactSystem: "Système de contact Maali",
    pdfAttached: "Une copie PDF de votre reçu est jointe à cet e-mail.",
    keepRecords: "Veuillez conserver cet e-mail pour vos dossiers.",
    paymentQuestions: "Si vous avez des questions sur ce paiement, contactez notre équipe d'assistance.",
    respondWithin24h: "Veuillez répondre à cette demande sous 24 heures.",
    newContactSubmission: "Nouvelle soumission du formulaire de contact", notification: "Notification Maali",
    newNotification: "Vous avez une nouvelle notification de Maali.",
  },
  pt: {
    dear: "Olá", bestRegards: "Com os melhores cumprimentos,", team: "A equipa Maali", maali: "Maali", applicant: "Candidato",
    project: "Projeto", applicationId: "ID da candidatura", status: "Estado", applicationSummary: "Resumo da candidatura",
    submitted: "Submetida", approved: "Aprovada", rejected: "Rejeitada", underReview: "Em análise", paid: "Pago",
    feedback: "Feedback", viewApplicationStatus: "Ver estado da candidatura", viewDetails: "Ver detalhes",
    browseOpportunities: "Explorar oportunidades", trackApplication: "Acompanhar candidatura",
    goToDashboard: "Ir para o painel", resubmitVerification: "Reenviar verificação",
    exploreOpportunities: "Explorar oportunidades", verifyEmail: "Verificar endereço de e-mail",
    resetPassword: "Redefinir palavra-passe", acceptInvitation: "Aceitar convite",
    amount: "Montante", date: "Data", invoiceNum: "Fatura n.º", transactionId: "ID da transação", name: "Nome",
    email: "E-mail", phone: "Telefone", country: "País", subject: "Assunto", message: "Mensagem",
    yourMessage: "A sua mensagem", noMessage: "Nenhuma mensagem fornecida", na: "N/D", reasonForRejection: "Motivo da rejeição",
    referenceId: "ID de referência", submissionId: "ID de submissão", contactSystem: "Sistema de contacto Maali",
    pdfAttached: "Uma cópia PDF do seu recibo está anexada a este e-mail.",
    keepRecords: "Guarde este e-mail para os seus registos.",
    paymentQuestions: "Se tiver dúvidas sobre este pagamento, contacte a nossa equipa de apoio.",
    respondWithin24h: "Responda a este pedido no prazo de 24 horas.",
    newContactSubmission: "Nova submissão do formulário de contacto", notification: "Notificação Maali",
    newNotification: "Tem uma nova notificação da Maali.",
  },
  de: {
    dear: "Guten Tag", bestRegards: "Mit freundlichen Grüßen,", team: "Das Maali-Team", maali: "Maali", applicant: "Bewerber",
    project: "Projekt", applicationId: "Bewerbungs-ID", status: "Status", applicationSummary: "Bewerbungsübersicht",
    submitted: "Eingereicht", approved: "Genehmigt", rejected: "Abgelehnt", underReview: "In Prüfung", paid: "Bezahlt",
    feedback: "Feedback", viewApplicationStatus: "Bewerbungsstatus ansehen", viewDetails: "Details ansehen",
    browseOpportunities: "Opportunities durchsuchen", trackApplication: "Bewerbung verfolgen",
    goToDashboard: "Zum Dashboard", resubmitVerification: "Verifizierung erneut einreichen",
    exploreOpportunities: "Opportunities entdecken", verifyEmail: "E-Mail-Adresse bestätigen",
    resetPassword: "Passwort zurücksetzen", acceptInvitation: "Einladung annehmen",
    amount: "Betrag", date: "Datum", invoiceNum: "Rechnung Nr.", transactionId: "Transaktions-ID", name: "Name",
    email: "E-Mail", phone: "Telefon", country: "Land", subject: "Betreff", message: "Nachricht",
    yourMessage: "Ihre Nachricht", noMessage: "Keine Nachricht angegeben", na: "k. A.", reasonForRejection: "Ablehnungsgrund",
    referenceId: "Referenz-ID", submissionId: "Einreichungs-ID", contactSystem: "Maali-Kontaktsystem",
    pdfAttached: "Eine PDF-Kopie Ihrer Quittung ist dieser E-Mail beigefügt.",
    keepRecords: "Bitte bewahren Sie diese E-Mail für Ihre Unterlagen auf.",
    paymentQuestions: "Bei Fragen zu dieser Zahlung wenden Sie sich bitte an unser Support-Team.",
    respondWithin24h: "Bitte antworten Sie auf diese Anfrage innerhalb von 24 Stunden.",
    newContactSubmission: "Neue Kontaktformular-Einreichung", notification: "Maali-Benachrichtigung",
    newNotification: "Sie haben eine neue Benachrichtigung von Maali.",
  },
};

export interface EmailTypeCopy {
  subject: (ctx: { projectTitle?: string; partnerOrgName?: string; subjectLabel?: string }) => string;
  title: string;
}

export const EMAIL_TYPE_COPY: Record<string, Record<EmailLocale, EmailTypeCopy>> = {
  application_submitted: {
    en: { subject: ({ projectTitle }) => `Application Submitted - ${projectTitle || "Maali"}`, title: "Application Submitted" },
    fr: { subject: ({ projectTitle }) => `Candidature soumise - ${projectTitle || "Maali"}`, title: "Candidature soumise" },
    pt: { subject: ({ projectTitle }) => `Candidatura submetida - ${projectTitle || "Maali"}`, title: "Candidatura submetida" },
    de: { subject: ({ projectTitle }) => `Bewerbung eingereicht - ${projectTitle || "Maali"}`, title: "Bewerbung eingereicht" },
  },
  application_approved: {
    en: { subject: ({ projectTitle }) => `Congratulations! Your Application Has Been Approved - ${projectTitle || "Maali"}`, title: "Application Approved" },
    fr: { subject: ({ projectTitle }) => `Félicitations ! Votre candidature a été approuvée - ${projectTitle || "Maali"}`, title: "Candidature approuvée" },
    pt: { subject: ({ projectTitle }) => `Parabéns! A sua candidatura foi aprovada - ${projectTitle || "Maali"}`, title: "Candidatura aprovada" },
    de: { subject: ({ projectTitle }) => `Glückwunsch! Ihre Bewerbung wurde genehmigt - ${projectTitle || "Maali"}`, title: "Bewerbung genehmigt" },
  },
  application_rejected: {
    en: { subject: ({ projectTitle }) => `Application Update - ${projectTitle || "Maali"}`, title: "Application Update" },
    fr: { subject: ({ projectTitle }) => `Mise à jour de candidature - ${projectTitle || "Maali"}`, title: "Mise à jour de candidature" },
    pt: { subject: ({ projectTitle }) => `Atualização da candidatura - ${projectTitle || "Maali"}`, title: "Atualização da candidatura" },
    de: { subject: ({ projectTitle }) => `Bewerbungsupdate - ${projectTitle || "Maali"}`, title: "Bewerbungsupdate" },
  },
  application_under_review: {
    en: { subject: ({ projectTitle }) => `Your Application is Under Review - ${projectTitle || "Maali"}`, title: "Application Under Review" },
    fr: { subject: ({ projectTitle }) => `Votre candidature est en cours d'examen - ${projectTitle || "Maali"}`, title: "Candidature en cours d'examen" },
    pt: { subject: ({ projectTitle }) => `A sua candidatura está em análise - ${projectTitle || "Maali"}`, title: "Candidatura em análise" },
    de: { subject: ({ projectTitle }) => `Ihre Bewerbung wird geprüft - ${projectTitle || "Maali"}`, title: "Bewerbung in Prüfung" },
  },
  status_update: {
    en: { subject: ({ projectTitle }) => `Application Status Update - ${projectTitle || "Maali"}`, title: "Status Update" },
    fr: { subject: ({ projectTitle }) => `Mise à jour du statut - ${projectTitle || "Maali"}`, title: "Mise à jour du statut" },
    pt: { subject: ({ projectTitle }) => `Atualização de estado - ${projectTitle || "Maali"}`, title: "Atualização de estado" },
    de: { subject: ({ projectTitle }) => `Statusaktualisierung - ${projectTitle || "Maali"}`, title: "Statusaktualisierung" },
  },
  welcome: {
    en: { subject: () => "Welcome to Maali! 🌱", title: "Welcome to Maali" },
    fr: { subject: () => "Bienvenue sur Maali ! 🌱", title: "Bienvenue sur Maali" },
    pt: { subject: () => "Bem-vindo à Maali! 🌱", title: "Bem-vindo à Maali" },
    de: { subject: () => "Willkommen bei Maali! 🌱", title: "Willkommen bei Maali" },
  },
  email_verification: {
    en: { subject: () => "Verify Your Email - Maali", title: "Verify your email address" },
    fr: { subject: () => "Vérifiez votre e-mail - Maali", title: "Vérifiez votre adresse e-mail" },
    pt: { subject: () => "Verifique o seu e-mail - Maali", title: "Verifique o seu endereço de e-mail" },
    de: { subject: () => "E-Mail bestätigen - Maali", title: "Bestätigen Sie Ihre E-Mail-Adresse" },
  },
  password_reset: {
    en: { subject: () => "Reset Your Password - Maali", title: "Reset your password" },
    fr: { subject: () => "Réinitialisez votre mot de passe - Maali", title: "Réinitialisez votre mot de passe" },
    pt: { subject: () => "Redefina a sua palavra-passe - Maali", title: "Redefina a sua palavra-passe" },
    de: { subject: () => "Passwort zurücksetzen - Maali", title: "Passwort zurücksetzen" },
  },
  contact_confirmation: {
    en: { subject: () => "Thank You for Contacting Maali", title: "Message Received" },
    fr: { subject: () => "Merci d'avoir contacté Maali", title: "Message reçu" },
    pt: { subject: () => "Obrigado por contactar a Maali", title: "Mensagem recebida" },
    de: { subject: () => "Vielen Dank für Ihre Nachricht an Maali", title: "Nachricht erhalten" },
  },
  payment_receipt: {
    en: { subject: ({ projectTitle }) => `Payment Receipt - ${projectTitle || "Maali"}`, title: "Payment Receipt" },
    fr: { subject: ({ projectTitle }) => `Reçu de paiement - ${projectTitle || "Maali"}`, title: "Reçu de paiement" },
    pt: { subject: ({ projectTitle }) => `Recibo de pagamento - ${projectTitle || "Maali"}`, title: "Recibo de pagamento" },
    de: { subject: ({ projectTitle }) => `Zahlungsbeleg - ${projectTitle || "Maali"}`, title: "Zahlungsbeleg" },
  },
  contact_submission: {
    en: { subject: ({ subjectLabel }) => `New Contact Form Submission: ${subjectLabel || "General Inquiry"}`, title: "New Contact Form Submission" },
    fr: { subject: ({ subjectLabel }) => `Nouvelle soumission de contact : ${subjectLabel || "Demande générale"}`, title: "Nouvelle soumission de contact" },
    pt: { subject: ({ subjectLabel }) => `Nova submissão de contacto: ${subjectLabel || "Pedido geral"}`, title: "Nova submissão de contacto" },
    de: { subject: ({ subjectLabel }) => `Neue Kontaktanfrage: ${subjectLabel || "Allgemeine Anfrage"}`, title: "Neue Kontaktanfrage" },
  },
  kyc_verified: {
    en: { subject: () => "Identity Verification Approved - Maali", title: "Identity Verification Approved" },
    fr: { subject: () => "Vérification d'identité approuvée - Maali", title: "Vérification d'identité approuvée" },
    pt: { subject: () => "Verificação de identidade aprovada - Maali", title: "Verificação de identidade aprovada" },
    de: { subject: () => "Identitätsprüfung genehmigt - Maali", title: "Identitätsprüfung genehmigt" },
  },
  kyc_rejected: {
    en: { subject: () => "Identity Verification Update - Maali", title: "Identity Verification Not Approved" },
    fr: { subject: () => "Mise à jour de vérification d'identité - Maali", title: "Vérification d'identité non approuvée" },
    pt: { subject: () => "Atualização da verificação de identidade - Maali", title: "Verificação de identidade não aprovada" },
    de: { subject: () => "Update zur Identitätsprüfung - Maali", title: "Identitätsprüfung nicht genehmigt" },
  },
  partner_invite: {
    en: { subject: ({ partnerOrgName }) => `You've been invited to manage ${partnerOrgName || "your organization"} on Maali`, title: "You're invited to Maali Partner Portal" },
    fr: { subject: ({ partnerOrgName }) => `Invitation à gérer ${partnerOrgName || "votre organisation"} sur Maali`, title: "Invitation au portail partenaire Maali" },
    pt: { subject: ({ partnerOrgName }) => `Convite para gerir ${partnerOrgName || "a sua organização"} na Maali`, title: "Convite para o portal de parceiros Maali" },
    de: { subject: ({ partnerOrgName }) => `Einladung zur Verwaltung von ${partnerOrgName || "Ihrer Organisation"} auf Maali`, title: "Einladung zum Maali-Partnerportal" },
  },
};

export const CONTACT_SUBJECT_LABELS: Record<EmailLocale, Record<string, string>> = {
  en: { funding: "Funding Inquiry", application: "Application Support", partnership: "Partnership", technical: "Technical Support", general: "General Inquiry" },
  fr: { funding: "Demande de financement", application: "Assistance candidature", partnership: "Partenariat", technical: "Support technique", general: "Demande générale" },
  pt: { funding: "Pedido de financiamento", application: "Apoio à candidatura", partnership: "Parceria", technical: "Suporte técnico", general: "Pedido geral" },
  de: { funding: "Finanzierungsanfrage", application: "Bewerbungsunterstützung", partnership: "Partnerschaft", technical: "Technischer Support", general: "Allgemeine Anfrage" },
};

export function getEmailLabels(locale: EmailLocale): EmailLabels {
  return LABELS[locale];
}

export function pickLocale(locale: EmailLocale, copy: Partial<Record<EmailLocale, string>> & { en: string }): string {
  return copy[locale] ?? copy.en;
}

export function getEmailTypeCopy(type: string, locale: EmailLocale): EmailTypeCopy {
  return EMAIL_TYPE_COPY[type]?.[locale] ?? EMAIL_TYPE_COPY[type]?.en ?? {
    subject: () => LABELS[locale].notification,
    title: LABELS[locale].notification,
  };
}
