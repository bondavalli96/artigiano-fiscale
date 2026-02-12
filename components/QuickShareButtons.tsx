import { View, Text, TouchableOpacity, Linking, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/lib/utils/format";
import { useI18n } from "@/lib/i18n";

interface QuickShareButtonsProps {
  pdfUrl: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  documentType: "preventivo" | "fattura";
  documentNumber: string;
  total: number;
  artisanName: string;
}

export function QuickShareButtons({
  pdfUrl,
  clientPhone,
  clientEmail,
  documentType,
  documentNumber,
  total,
  artisanName,
}: QuickShareButtonsProps) {
  const { t } = useI18n();
  const label = documentType === "preventivo" ? t("quoteTitle") : t("invoiceTitle");

  const buildMessage = () => {
    let msg = `${label} ${documentNumber} - ${formatCurrency(total)}\n`;
    msg += `Da: ${artisanName}\n`;
    if (pdfUrl) {
      msg += `\nDocumento: ${pdfUrl}`;
    }
    return msg;
  };

  const handleWhatsApp = async () => {
    if (!clientPhone) {
      Alert.alert(t("phoneMissing"), t("phoneMissingMsg"));
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const phone = clientPhone.replace(/\s+/g, "").replace(/^0/, "+39");
    const normalizedPhone = phone.startsWith("+") ? phone : `+39${phone}`;
    const message = encodeURIComponent(buildMessage());
    const url = `whatsapp://send?phone=${normalizedPhone}&text=${message}`;

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(t("whatsappNotAvailable"), t("whatsappNotInstalled"));
    }
  };

  const handleEmail = async () => {
    if (!clientEmail) {
      Alert.alert(t("emailMissing"), t("emailMissingMsg"));
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const subject = encodeURIComponent(`${label} ${documentNumber} - ${artisanName}`);
    const body = encodeURIComponent(buildMessage());
    const url = `mailto:${clientEmail}?subject=${subject}&body=${body}`;

    await Linking.openURL(url);
  };

  const handleSend = () => {
    Alert.alert(t("send"), t("chooseSendChannel"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: "WhatsApp",
        onPress: handleWhatsApp,
      },
      {
        text: "Email",
        onPress: handleEmail,
      },
    ]);
  };

  if (!pdfUrl) return null;

  return (
    <View className="mt-2">
      <TouchableOpacity
        onPress={handleSend}
        className="rounded-xl py-3 items-center bg-primary mb-2"
        activeOpacity={0.8}
      >
        <Text className="text-white font-semibold">{t("send")}</Text>
      </TouchableOpacity>

      <View className="flex-row gap-2">
      <TouchableOpacity
        onPress={handleWhatsApp}
        disabled={!clientPhone}
        className={`flex-1 rounded-xl py-3 items-center flex-row justify-center ${
          clientPhone ? "bg-green-600" : "bg-gray-300"
        }`}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="whatsapp" size={20} color="white" />
        <Text className="text-white font-semibold ml-2">WhatsApp</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleEmail}
        disabled={!clientEmail}
        className={`flex-1 rounded-xl py-3 items-center flex-row justify-center ${
          clientEmail ? "bg-blue-600" : "bg-gray-300"
        }`}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="email-outline" size={20} color="white" />
        <Text className="text-white font-semibold ml-2">Email</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
}
