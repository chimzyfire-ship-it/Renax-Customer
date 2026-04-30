import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Defs, LinearGradient, Stop, Mask, G } from 'react-native-svg';

const AnimatedView = Animated.createAnimatedComponent(View);

// Math helper for coordinates
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const generateGeometricDonut = () => {
  const cx = 50;
  const cy = 50;
  const rOuter = 46;
  const rInner = 26;
  const segments = 12;
  const angleStep = 360 / segments;

  let path = '';
  for (let i = 0; i < segments; i++) {
    const angle1 = i * angleStep;
    const angle2 = (i + 1) * angleStep;
    const angleHalf = angle1 + angleStep / 2;

    const pOuter1 = polarToCartesian(cx, cy, rOuter, angle1);
    const pOuter2 = polarToCartesian(cx, cy, rOuter, angle2);
    const pInner1 = polarToCartesian(cx, cy, rInner, angle1);
    const pInner2 = polarToCartesian(cx, cy, rInner, angle2);

    const pMidOuter = polarToCartesian(cx, cy, rOuter, angleHalf);
    const pMidInner = polarToCartesian(cx, cy, rInner, angleHalf);

    // Spokes
    path += `M ${pInner1.x} ${pInner1.y} L ${pOuter1.x} ${pOuter1.y} `;
    // Inner zig-zag
    path += `M ${pInner1.x} ${pInner1.y} L ${pMidOuter.x} ${pMidOuter.y} L ${pInner2.x} ${pInner2.y} `;
    // Outer zig-zag
    path += `M ${pOuter1.x} ${pOuter1.y} L ${pMidInner.x} ${pMidInner.y} L ${pOuter2.x} ${pOuter2.y} `;
  }
  return path;
};

// Generates an SVG arc path
const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x, start.y, 
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ');
};

interface RenaxLoaderProps {
  size?: number;
  color?: string;
  baseColor?: string;
  glowColor?: string;
}

export default function RenaxLoader({ 
  size = 64, 
  color = '#004d3d', 
  baseColor = '#D4C5A5', 
  glowColor = '#ccfd3a' 
}: RenaxLoaderProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 360])}deg` }],
    };
  });

  const geoPath = generateGeometricDonut();
  const highlightArc = describeArc(50, 50, 36, 0, 120);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Base Geometric Pattern */}
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={baseColor} stopOpacity="0.8" />
            <Stop offset="50%" stopColor="#FFF2D8" stopOpacity="0.9" />
            <Stop offset="100%" stopColor={baseColor} stopOpacity="0.6" />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="46" stroke="url(#gold)" strokeWidth="1.5" fill="none" />
        <Circle cx="50" cy="50" r="26" stroke="url(#gold)" strokeWidth="1.5" fill="none" />
        <Path d={geoPath} stroke="url(#gold)" strokeWidth="1.2" fill="none" />
      </Svg>

      {/* Rotating Glow Element */}
      <AnimatedView style={[StyleSheet.absoluteFillObject, animatedStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="sweep" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={glowColor} stopOpacity="1" />
              <Stop offset="40%" stopColor={color} stopOpacity="0.8" />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </LinearGradient>
            <Mask id="geoMask">
               <Circle cx="50" cy="50" r="46" stroke="#fff" strokeWidth="2.5" fill="none" />
               <Circle cx="50" cy="50" r="26" stroke="#fff" strokeWidth="2.5" fill="none" />
               <Path d={geoPath} stroke="#fff" strokeWidth="2.5" fill="none" />
            </Mask>
          </Defs>
          
          {/* A thick arc that uses the geometric mask so it only highlights the geometry */}
          <Path 
            d={highlightArc} 
            stroke="url(#sweep)" 
            strokeWidth="20" 
            fill="none" 
            strokeLinecap="round" 
            mask="url(#geoMask)"
            {...(Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 4px rgba(204,253,58,0.5))' } as any : {})}
          />
        </Svg>
      </AnimatedView>
    </View>
  );
}
