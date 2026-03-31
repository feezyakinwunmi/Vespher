// app/hooks/useAddressPicker.ts
import { useState } from 'react';

interface Address {
  fullAddress: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export const useAddressPicker = () => {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  const openPicker = () => setIsPickerVisible(true);
  const closePicker = () => setIsPickerVisible(false);

  const handleAddressSelect = (address: Address) => {
    setSelectedAddress(address);
    closePicker();
  };

  return {
    isPickerVisible,
    selectedAddress,
    openPicker,
    closePicker,
    handleAddressSelect,
  };
};