import React, { useState, useRef } from 'react';
import { View, TextInput, FlatList, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { MapPin, Search, CheckCircle2 } from 'lucide-react-native';

interface OSMResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface OSMAutocompleteProps {
  placeholder: string;
  onSelect: (data: { address: string; lat: number; lon: number }) => void;
  icon?: React.ReactNode;
}

export default function OSMAutocomplete({ placeholder, onSelect, icon }: OSMAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OSMResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchOSM = async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    
    setLoading(true);
    setShowDropdown(true);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5&countrycodes=ng`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'RENAX-Customer-App/1.0',
        },
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.warn('OSM Fetch Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setQuery(text);
    setIsFilled(false);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      searchOSM(text);
    }, 800);
  };

  const handleSelect = (item: OSMResult) => {
    setQuery(item.display_name);
    setShowDropdown(false);
    setResults([]);
    setIsFilled(true);
    onSelect({
      address: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrap, isFilled ? styles.inputWrapFilled : null]}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#aaa"
          style={styles.input}
          value={query}
          onChangeText={handleTextChange}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
        />
        {loading ? (
          <ActivityIndicator size="small" color="#004d3d" />
        ) : isFilled ? (
          <CheckCircle2 color="#10B981" size={16} style={{ marginLeft: 6 }} />
        ) : (
          icon || <Search color="#004d3d" size={16} />
        )}
      </View>

      {showDropdown && results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id.toString()}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.resultItem} onPress={() => handleSelect(item)}>
                <MapPin color="#c2862e" size={16} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.resultText} numberOfLines={2}>{item.display_name}</Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 50,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
    height: 48,
  },
  inputWrapFilled: {
    borderColor: '#10B981',
    backgroundColor: '#f0fdf4',
  },
  input: {
    flex: 1,
    fontFamily: 'Outfit_4',
    fontSize: 14,
    color: '#333',
    height: '100%',
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 999,
  },
  resultItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'flex-start',
  },
  resultText: {
    flex: 1,
    fontFamily: 'Outfit_4',
    fontSize: 13,
    color: '#444',
  },
});
