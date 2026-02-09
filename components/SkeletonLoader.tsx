import { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonLoader({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonLoaderProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: "#e5e7eb",
          opacity,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View className="bg-white rounded-xl p-4 mb-2 mx-4">
      <SkeletonLoader width="60%" height={14} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="40%" height={12} style={{ marginBottom: 4 }} />
      <SkeletonLoader width="30%" height={20} />
    </View>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="pt-2">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}
