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
  onClear?: () => void;
  icon?: React.ReactNode;
}

export default function OSMAutocomplete({ placeholder, onSelect, onClear, icon }: OSMAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OSMResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOSMResults = async (text: string, limit = 5): Promise<OSMResult[]> => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=${limit}&countrycodes=ng`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RENAX-Customer-App/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  };

  const searchOSM = async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      setShowDropdown(false);
      setErrorMessage('');
      return;
    }
    
    setLoading(true);
    setShowDropdown(true);
    setErrorMessage('');

    try {
      const data = await fetchOSMResults(text);
      setResults(data);
    } catch (error) {
      console.warn('OSM Fetch Error:', error);
      setResults([]);
      setErrorMessage('We could not load address suggestions right now.');
    } finally {
      setLoading(false);
    }
  };

  const finalizeSelection = (item: OSMResult) => {
    setQuery(item.display_name);
    setShowDropdown(false);
    setResults([]);
    setErrorMessage('');
    setIsFilled(true);
    onSelect({
      address: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    });
  };

  const resolveTypedAddress = async () => {
    const text = query.trim();
    if (!text || isFilled) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const searches = [text];
      if (!/nigeria/i.test(text)) searches.push(`${text}, Nigeria`);

      for (const candidate of searches) {
        const matches = await fetchOSMResults(candidate, 1);
        if (matches.length > 0) {
          finalizeSelection(matches[0]);
          return;
        }
      }

      setErrorMessage('Address not resolved yet. Refine it or choose a suggestion below.');
      setShowDropdown(true);
    } catch (error) {
      console.warn('OSM Resolve Error:', error);
      setErrorMessage('We could not resolve this typed address. Please try a more specific format.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setQuery(text);
    setIsFilled(false);
    setErrorMessage('');
    onClear?.();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      searchOSM(text);
    }, 800);
  };

  const handleSelect = (item: OSMResult) => {
    finalizeSelection(item);
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
          onSubmitEditing={resolveTypedAddress}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => {
              resolveTypedAddress();
            }, 180);
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

      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

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
          {!isFilled && query.trim().length >= 6 ? (
            <Pressable style={styles.useTypedBtn} onPress={resolveTypedAddress}>
              <CheckCircle2 color="#047857" size={16} style={{ marginRight: 8 }} />
              <Text style={styles.useTypedText}>Use typed address and calculate from it</Text>
            </Pressable>
          ) : null}
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
  errorText: {
    marginTop: 6,
    fontFamily: 'Outfit_4',
    fontSize: 12,
    color: '#B45309',
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
  useTypedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecfdf5',
    backgroundColor: '#f0fdf4',
  },
  useTypedText: {
    fontFamily: 'Outfit_6',
    fontSize: 13,
    color: '#047857',
  },
});
