import React, { createContext, useContext, useEffect, useState } from "react";
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
} from "react-native-purchases";
import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";
import { updateUserProfile } from "@/firebase";
import { useAuthContext } from "./AuthContext";

interface PurchaseContextType {
  isLoading: boolean;
  currentOffering: { [key: string]: PurchasesOffering } | null;
  customerInfo: CustomerInfo | null;
  handlePurchase: (packageToPurchase: PurchasesPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
}

const PurchaseContext = createContext<PurchaseContextType | undefined>(
  undefined
);

export const PurchaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuthContext();
  const [isLoading, setIsLoading] = useState(true);
  const [currentOffering, setCurrentOffering] = useState<{
    [key: string]: PurchasesOffering;
  } | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // configure the Purchases SDK and get the offerings and customer info
  useEffect(() => {
    const initPurchases = async () => {
      if (Platform.OS === "android") {
        console.log("Configuring RevenueCat for Android");
        console.log(process.env.EXPO_PUBLIC_RC_ANDROID);
        Purchases.configure({
          apiKey: process.env.EXPO_PUBLIC_RC_ANDROID!,
        });
      } else {
        console.log("Configuring RevenueCat for iOS");
        console.log(process.env.EXPO_PUBLIC_RC_IOS);
        Purchases.configure({
          apiKey: process.env.EXPO_PUBLIC_RC_IOS!,
        });
      }
      try {
        const offerings = await Purchases.getOfferings();
        setCurrentOffering(offerings.all);
      } catch (error) {
        console.error("Error initializing purchases:", error);
      } finally {
        setIsLoading(false);
      }
    };
    initPurchases();
  }, []);

  // listen for customer info updates and update the purchase status
  useEffect(() => {
    if (user) {
      Purchases.addCustomerInfoUpdateListener((info) => {
        console.log("Customer info updated", info);
        updatePurchaseStatus(info);
        handlePurchaseNotification(info);
      });
    }
  }, [user]);

  // update and handle customer info and db access level
  const updatePurchaseStatus = async (customerInfo: CustomerInfo) => {
    console.log("Customer info updated in DB", customerInfo);
    setCustomerInfo(customerInfo);
    if (customerInfo.entitlements.active["pro"] !== undefined) {
      console.log("Purchase successful:", customerInfo);
      if (user?.uid) {
        try {
          console.log("Updating user profile for UID:", user?.uid);
          await updateUserProfile(user?.uid, { isPro: true });
        } catch (error) {}
      }
    }
    if (customerInfo.entitlements.active["deluxe"] !== undefined) {
      console.log("Purchase successful:", customerInfo);
      if (user?.uid) {
        try {
          console.log("Updating user profile for UID:", user?.uid);
          await updateUserProfile(user?.uid, { isDeluxe: true });
        } catch (error) {}
      }
    }
  };

  // send push notifications for this device
  const handlePurchaseNotification = async (info: CustomerInfo) => {
    console.log("Handling purchase notification");
    const previousEntitlements = customerInfo?.entitlements.active || {};
    const newEntitlements = info.entitlements.active;
    for (const entitlement in newEntitlements) {
      if (!previousEntitlements[entitlement]) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Purchase Successful!",
            body: `Thank you for purchasing ${entitlement}! Enjoy your premium features.`,
          },
          trigger: null,
        });
      }
    }

    // Check for expired subscriptions
    for (const entitlement in previousEntitlements) {
      if (!newEntitlements[entitlement]) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Subscription Expired",
            body: `Your ${entitlement} subscription has expired. Renew to continue enjoying premium features.`,
          },
          trigger: null,
        });
      }
    }
  };

  // custom handlePurchase function
  const handlePurchase = async (packageToPurchase: PurchasesPackage) => {
    try {
      setIsLoading(true);
      const { customerInfo } = await Purchases.purchasePackage(
        packageToPurchase
      );
      console.log("Purchase successful:", customerInfo);
      updatePurchaseStatus(customerInfo);
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error("Purchase error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setIsLoading(true);
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.activeSubscriptions.length > 0) {
        Alert.alert("Purchase Restored!", "Your purchase has been restored.");
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Purchase Restored!",
            body: `Your purchase has been restored. Enjoy your premium features.`,
          },
          trigger: null,
        });
      } else {
        Alert.alert(
          "No Active Subscriptions",
          "You don't have any active subscriptions."
        );
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "No Active Subscriptions",
            body: `You don't have any active subscriptions. Purchase a plan to enjoy premium features.`,
          },
          trigger: null,
        });
      }
      updatePurchaseStatus(customerInfo);
    } catch (error) {
      console.error("Restore error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PurchaseContext.Provider
      value={{
        isLoading,
        currentOffering,
        customerInfo,
        handlePurchase,
        restorePurchases,
      }}
    >
      {children}
    </PurchaseContext.Provider>
  );
};

// Custom hook
export const usePurchases = () => {
  const context = useContext(PurchaseContext);
  if (context === undefined) {
    throw new Error("usePurchases must be used within a PurchaseProvider");
  }
  return context;
};
