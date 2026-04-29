import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Eye,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  BankAccountRecord,
  createBankTransferTopUp,
  deleteBankAccount,
  deletePaymentMethod,
  fetchWalletSnapshot,
  PaymentMethodRecord,
  requestWalletWithdrawal,
  resolveCustomerId,
  saveBankAccount,
  savePaymentMethod,
  topUpWalletByCard,
  WalletTransactionRecord,
  WalletRecord,
} from '../../utils/customerData';

type PaymentMethodsTabProps = {
  customerId?: string | null;
};

type MethodFormState = {
  id?: string;
  type: PaymentMethodRecord['type'];
  providerName: string;
  label: string;
  accountName: string;
  last4: string;
  expiryMonth: string;
  expiryYear: string;
  isDefault: boolean;
};

type BankFormState = {
  id?: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
};

const emptyMethodForm: MethodFormState = {
  type: 'card',
  providerName: '',
  label: '',
  accountName: '',
  last4: '',
  expiryMonth: '',
  expiryYear: '',
  isDefault: false,
};

const emptyBankForm: BankFormState = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  isDefault: false,
};

const formatAmount = (amount: number | null | undefined) =>
  `₦${Number(amount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const formatMethodDetail = (method: PaymentMethodRecord) => {
  if (method.type === 'card') {
    const expiry = method.expiry_month && method.expiry_year
      ? `Expiry ${String(method.expiry_month).padStart(2, '0')}/${String(method.expiry_year).slice(-2)}`
      : 'Card on file';
    return `${method.last4 ? `•••• ${method.last4}` : method.label} • ${expiry}`;
  }

  if (method.type === 'momo') {
    return method.last4 ? `Wallet ending ${method.last4}` : 'Mobile money profile';
  }

  return method.account_name || 'Bank transfer profile';
};

const transactionTone = (status: string) => {
  if (status === 'success') return '#0F9D58';
  if (status === 'pending') return '#F59E0B';
  return '#B91C1C';
};

const transactionLabel = (transaction: WalletTransactionRecord) => {
  if (transaction.type === 'deposit') return 'Wallet top-up';
  if (transaction.type === 'withdrawal') return 'Withdrawal';
  if (transaction.type === 'payment') return 'Shipment payment';
  return 'Wallet activity';
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        style={styles.input}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

export default function PaymentMethodsTab({ customerId }: PaymentMethodsTabProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const isCompact = width < 640;
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(customerId ?? null);
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([]);
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [flashMessage, setFlashMessage] = useState('');
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [methodForm, setMethodForm] = useState<MethodFormState>(emptyMethodForm);
  const [bankForm, setBankForm] = useState<BankFormState>(emptyBankForm);
  const [fundAmount, setFundAmount] = useState('');
  const [fundSource, setFundSource] = useState<'card' | 'bank_transfer'>('card');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (customerId) {
      setResolvedCustomerId(customerId);
      return;
    }

    resolveCustomerId()
      .then(setResolvedCustomerId)
      .catch((error) => {
        console.error('Could not resolve customer id', error);
        setErrorMessage('Wallet setup could not identify the current customer.');
      });
  }, [customerId]);

  const cardMethods = useMemo(
    () => methods.filter((method) => method.type === 'card'),
    [methods]
  );

  const loadWalletData = useCallback(async () => {
    if (!resolvedCustomerId) return;
    setIsLoading(true);

    try {
      const snapshot = await fetchWalletSnapshot(resolvedCustomerId);
      setWallet(snapshot.wallet);
      setMethods(snapshot.methods);
      setBankAccounts(snapshot.bankAccounts);
      setTransactions(snapshot.transactions);
      setErrorMessage('');

      setSelectedMethodId((current) => current || snapshot.methods[0]?.id || '');
      setSelectedBankAccountId((current) => current || snapshot.bankAccounts[0]?.id || '');
    } catch (error) {
      console.error('Failed to load wallet snapshot', error);
      setErrorMessage('Wallet data is unavailable until the new Supabase migration is applied.');
    } finally {
      setIsLoading(false);
    }
  }, [resolvedCustomerId]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const openMethodEditor = (method?: PaymentMethodRecord) => {
    if (method) {
      setMethodForm({
        id: method.id,
        type: method.type,
        providerName: method.provider_name,
        label: method.label,
        accountName: method.account_name || '',
        last4: method.last4 || '',
        expiryMonth: method.expiry_month ? String(method.expiry_month) : '',
        expiryYear: method.expiry_year ? String(method.expiry_year) : '',
        isDefault: method.is_default,
      });
    } else {
      setMethodForm(emptyMethodForm);
    }
    setShowMethodModal(true);
  };

  const openBankEditor = (account?: BankAccountRecord) => {
    if (account) {
      setBankForm({
        id: account.id,
        bankName: account.bank_name,
        accountName: account.account_name,
        accountNumber: account.account_number_last4,
        isDefault: account.is_default,
      });
    } else {
      setBankForm(emptyBankForm);
    }
    setShowBankModal(true);
  };

  const handleSaveMethod = async () => {
    if (!resolvedCustomerId) return;
    setActionLoading(true);

    try {
      await savePaymentMethod(resolvedCustomerId, {
        id: methodForm.id,
        type: methodForm.type,
        provider_name: methodForm.providerName || (methodForm.type === 'card' ? 'Card' : methodForm.type === 'momo' ? 'Mobile Money' : 'Bank Transfer'),
        label: methodForm.label,
        account_name: methodForm.accountName || null,
        last4: methodForm.last4 || null,
        expiry_month: methodForm.expiryMonth ? Number(methodForm.expiryMonth) : null,
        expiry_year: methodForm.expiryYear ? Number(methodForm.expiryYear) : null,
        is_default: methodForm.isDefault,
      });
      setShowMethodModal(false);
      setFlashMessage(methodForm.id ? 'Payment method updated.' : 'Payment method added.');
      await loadWalletData();
    } catch (error: any) {
      setFlashMessage(error?.message || 'Could not save payment method.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    if (!resolvedCustomerId) return;
    setActionLoading(true);

    try {
      await deletePaymentMethod(resolvedCustomerId, methodId);
      setFlashMessage('Payment method removed.');
      await loadWalletData();
    } catch (error: any) {
      setFlashMessage(error?.message || 'Could not remove payment method.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveBankAccount = async () => {
    if (!resolvedCustomerId) return;
    setActionLoading(true);

    try {
      await saveBankAccount(resolvedCustomerId, {
        id: bankForm.id,
        bank_name: bankForm.bankName,
        account_name: bankForm.accountName,
        account_number: bankForm.accountNumber,
        is_default: bankForm.isDefault,
      });
      setShowBankModal(false);
      setFlashMessage(bankForm.id ? 'Bank account updated.' : 'Bank account added for withdrawals.');
      await loadWalletData();
    } catch (error: any) {
      setFlashMessage(error?.message || 'Could not save bank account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBank = async (bankAccountId: string) => {
    if (!resolvedCustomerId) return;
    setActionLoading(true);

    try {
      await deleteBankAccount(resolvedCustomerId, bankAccountId);
      setFlashMessage('Bank account removed.');
      await loadWalletData();
    } catch (error: any) {
      setFlashMessage(error?.message || 'Could not remove bank account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFundWallet = async () => {
    if (!resolvedCustomerId) return;
    const amount = Number(fundAmount);
    setActionLoading(true);

    try {
      if (fundSource === 'card') {
        const selectedMethod = cardMethods.find((method) => method.id === selectedMethodId);
        if (!selectedMethod) {
          throw new Error('Add a saved card before topping up from card.');
        }
        const result = await topUpWalletByCard(resolvedCustomerId, amount, selectedMethod);
        setFlashMessage(`Wallet funded successfully. New balance: ${formatAmount(result.balance)}.`);
      } else {
        const instructions = await createBankTransferTopUp(resolvedCustomerId, amount);
        setFlashMessage(
          `Transfer ${formatAmount(amount)} to ${instructions.bankName} (${instructions.accountNumber}) and use reference ${instructions.reference}.`
        );
      }

      setFundAmount('');
      setShowFundingModal(false);
      await loadWalletData();
    } catch (error: any) {
      setFlashMessage(error?.message || 'Could not start wallet funding.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!resolvedCustomerId) return;
    const amount = Number(withdrawAmount);
    const selectedAccount = bankAccounts.find((account) => account.id === selectedBankAccountId);
    setActionLoading(true);

    try {
      if (!selectedAccount) {
        throw new Error('Select a bank account for withdrawal.');
      }
      const result = await requestWalletWithdrawal(resolvedCustomerId, amount, selectedAccount);
      setWithdrawAmount('');
      setShowWithdrawalModal(false);
      setFlashMessage(`Withdrawal request created with reference ${result.reference}.`);
      await loadWalletData();
    } catch (error: any) {
      setFlashMessage(error?.message || 'Could not submit withdrawal request.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={{ padding: isCompact ? 12 : isMobile ? 16 : 32, paddingBottom: 80 }}>
        <Text style={[styles.pageTitle, isCompact && { fontSize: 22, marginBottom: 18 }]}>Payment Methods</Text>

        {flashMessage ? (
          <View style={styles.flashBanner}>
            <Text style={styles.flashText}>{flashMessage}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#004d3d" size="large" />
            <Text style={styles.centerStateText}>Loading wallet and payment data...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.walletHero, isCompact && { padding: 18 }]}>
              <View style={styles.walletHeroLeft}>
                <View style={styles.walletBadge}>
                  <Wallet color="#002B22" size={18} />
                  <Text style={styles.walletBadgeText}>RENAX Wallet</Text>
                </View>
                <Text style={styles.walletBalanceLabel}>Available Balance</Text>
                <Text style={styles.walletBalance}>{formatAmount(wallet?.balance)}</Text>
                <Text style={styles.walletHint}>
                  Use this balance at checkout by selecting `RENAX Wallet` when creating a shipment.
                </Text>
              </View>

              <View style={styles.walletHeroStats}>
                <View style={[styles.walletStatCard, isCompact && { minWidth: '100%' as any }]}>
                  <Text style={styles.walletStatLabel}>Pending</Text>
                  <Text style={styles.walletStatValue}>{formatAmount(wallet?.pending_balance)}</Text>
                </View>
                <View style={[styles.walletStatCard, isCompact && { minWidth: '100%' as any }]}>
                  <Text style={styles.walletStatLabel}>Funded</Text>
                  <Text style={styles.walletStatValue}>{formatAmount(wallet?.total_funded)}</Text>
                </View>
                <View style={[styles.walletStatCard, isCompact && { minWidth: '100%' as any }]}>
                  <Text style={styles.walletStatLabel}>Spent</Text>
                  <Text style={styles.walletStatValue}>{formatAmount(wallet?.total_spent)}</Text>
                </View>
              </View>

              <View style={styles.walletActions}>
                <Pressable style={[styles.primaryBtn, isCompact && { width: '100%' }]} onPress={() => setShowFundingModal(true)}>
                  <ArrowDownLeft color="#002B22" size={16} />
                  <Text style={styles.primaryBtnText}>Add Funds</Text>
                </Pressable>
                <Pressable style={[styles.secondaryBtn, isCompact && { width: '100%' }]} onPress={() => setShowWithdrawalModal(true)}>
                  <ArrowUpRight color="#004d3d" size={16} />
                  <Text style={styles.secondaryBtnText}>Withdraw</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.sectionCard, isCompact && { padding: 18 }]}>
              <View style={[styles.sectionHead, isCompact && { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View>
                  <Text style={styles.sectionTitle}>Saved Payment Methods</Text>
                  <Text style={styles.sectionSub}>Cards and collection channels customers can use to fund the wallet.</Text>
                </View>
                <Pressable style={[styles.smallActionBtn, isCompact && { alignSelf: 'flex-start' }]} onPress={() => openMethodEditor()}>
                  <Plus color="#004d3d" size={16} />
                  <Text style={styles.smallActionText}>Add Method</Text>
                </Pressable>
              </View>

              <View style={styles.grid}>
                {methods.map((method, index) => (
                  <Animated.View key={method.id} entering={FadeInDown.delay(index * 60).duration(300)} style={[styles.methodCard, isMobile && { width: '100%', minWidth: 0 }]}>
                    <View style={styles.methodHead}>
                      <View style={styles.methodIconWrap}>
                        {method.type === 'card' ? (
                          <CreditCard color="#004d3d" size={18} />
                        ) : method.type === 'momo' ? (
                          <Smartphone color="#004d3d" size={18} />
                        ) : (
                          <Banknote color="#004d3d" size={18} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.methodName}>{method.label}</Text>
                        <Text style={styles.methodSub}>{formatMethodDetail(method)}</Text>
                      </View>
                    </View>

                    <View style={styles.methodMetaRow}>
                      <Text style={styles.methodMeta}>{method.provider_name}</Text>
                      {method.is_default ? <Text style={styles.defaultPill}>Default</Text> : null}
                    </View>

                    <View style={styles.methodActions}>
                      <Pressable style={styles.actionPill} onPress={() => openMethodEditor(method)}>
                        <Pencil color="#004d3d" size={14} />
                        <Text style={styles.actionPillText}>Edit</Text>
                      </Pressable>
                      <Pressable style={styles.actionPill} onPress={() => handleDeleteMethod(method.id)}>
                        <Trash2 color="#B91C1C" size={14} />
                        <Text style={[styles.actionPillText, { color: '#B91C1C' }]}>Remove</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                ))}
              </View>
            </View>

            <View style={[styles.sectionCard, isCompact && { padding: 18 }]}>
              <View style={[styles.sectionHead, isCompact && { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View>
                  <Text style={styles.sectionTitle}>Withdrawal Accounts</Text>
                  <Text style={styles.sectionSub}>Customers can withdraw RENAX wallet balance back to any saved bank account.</Text>
                </View>
                <Pressable style={[styles.smallActionBtn, isCompact && { alignSelf: 'flex-start' }]} onPress={() => openBankEditor()}>
                  <Plus color="#004d3d" size={16} />
                  <Text style={styles.smallActionText}>Add Bank</Text>
                </Pressable>
              </View>

              <View style={styles.bankList}>
                {bankAccounts.length === 0 ? (
                  <Text style={styles.emptyText}>No bank account added yet.</Text>
                ) : (
                  bankAccounts.map((account) => (
                    <View key={account.id} style={styles.bankCard}>
                      <View>
                        <Text style={styles.bankName}>{account.bank_name}</Text>
                        <Text style={styles.bankSub}>
                          {account.account_name} •••• {account.account_number_last4}
                        </Text>
                      </View>
                      <View style={styles.methodActions}>
                        {account.is_default ? <Text style={styles.defaultPill}>Default</Text> : null}
                        <Pressable style={styles.actionPill} onPress={() => openBankEditor(account)}>
                          <Eye color="#004d3d" size={14} />
                          <Text style={styles.actionPillText}>View</Text>
                        </Pressable>
                        <Pressable style={styles.actionPill} onPress={() => handleDeleteBank(account.id)}>
                          <Trash2 color="#B91C1C" size={14} />
                          <Text style={[styles.actionPillText, { color: '#B91C1C' }]}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={[styles.sectionCard, isCompact && { padding: 18 }]}>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>Wallet Activity</Text>
                  <Text style={styles.sectionSub}>Every funding event, shipment payment, and withdrawal request is recorded here.</Text>
                </View>
              </View>

              {transactions.length === 0 ? (
                <Text style={styles.emptyText}>No wallet transactions yet.</Text>
              ) : (
                transactions.map((transaction) => (
                  <View key={transaction.id} style={styles.transactionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.transactionTitle}>{transactionLabel(transaction)}</Text>
                      <Text style={styles.transactionSub}>{transaction.description || transaction.reference}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.transactionAmount}>{formatAmount(transaction.amount)}</Text>
                      <Text style={[styles.transactionStatus, { color: transactionTone(transaction.status) }]}>
                        {transaction.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showMethodModal} transparent animationType="slide" onRequestClose={() => setShowMethodModal(false)}>
        <Pressable style={[styles.modalOverlay, isCompact && { padding: 12 }]} onPress={() => setShowMethodModal(false)}>
          <Pressable style={[styles.modalCard, isCompact && { padding: 18 }]} onPress={() => {}}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{methodForm.id ? 'Edit Payment Method' : 'Add Payment Method'}</Text>
              <Pressable onPress={() => setShowMethodModal(false)} style={styles.iconBtn}>
                <X color="#444" size={16} />
              </Pressable>
            </View>

            <View style={styles.segmentedRow}>
              {[
                { id: 'card', label: 'Card' },
                { id: 'bank_transfer', label: 'Bank Transfer' },
                { id: 'momo', label: 'Mobile Money' },
              ].map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setMethodForm((current) => ({ ...current, type: option.id as PaymentMethodRecord['type'] }))}
                  style={[styles.segmentBtn, methodForm.type === option.id && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, methodForm.type === option.id && styles.segmentTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <Field label="Provider" value={methodForm.providerName} onChangeText={(value) => setMethodForm((current) => ({ ...current, providerName: value }))} placeholder="e.g. Mastercard, Access Bank" />
            <Field label="Display Label" value={methodForm.label} onChangeText={(value) => setMethodForm((current) => ({ ...current, label: value }))} placeholder="e.g. Mastercard ending 9876" />
            <Field label="Account Name" value={methodForm.accountName} onChangeText={(value) => setMethodForm((current) => ({ ...current, accountName: value }))} placeholder="Name on card or account" />
            <Field label="Last 4 Digits" value={methodForm.last4} onChangeText={(value) => setMethodForm((current) => ({ ...current, last4: value.replace(/[^0-9]/g, '').slice(0, 4) }))} placeholder="1234" keyboardType="numeric" />

            {methodForm.type === 'card' ? (
              <View style={styles.inlineFields}>
                <Field label="Expiry Month" value={methodForm.expiryMonth} onChangeText={(value) => setMethodForm((current) => ({ ...current, expiryMonth: value.replace(/[^0-9]/g, '').slice(0, 2) }))} placeholder="12" keyboardType="numeric" />
                <Field label="Expiry Year" value={methodForm.expiryYear} onChangeText={(value) => setMethodForm((current) => ({ ...current, expiryYear: value.replace(/[^0-9]/g, '').slice(0, 4) }))} placeholder="2028" keyboardType="numeric" />
              </View>
            ) : null}

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setMethodForm((current) => ({ ...current, isDefault: !current.isDefault }))}
            >
              <View style={[styles.checkbox, methodForm.isDefault && styles.checkboxActive]} />
              <Text style={styles.checkboxText}>Use as default method</Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable style={styles.primaryBtn} onPress={handleSaveMethod} disabled={actionLoading}>
                <Text style={styles.primaryBtnText}>{actionLoading ? 'Saving...' : 'Save Method'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showBankModal} transparent animationType="slide" onRequestClose={() => setShowBankModal(false)}>
        <Pressable style={[styles.modalOverlay, isCompact && { padding: 12 }]} onPress={() => setShowBankModal(false)}>
          <Pressable style={[styles.modalCard, isCompact && { padding: 18 }]} onPress={() => {}}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{bankForm.id ? 'Edit Bank Account' : 'Add Bank Account'}</Text>
              <Pressable onPress={() => setShowBankModal(false)} style={styles.iconBtn}>
                <X color="#444" size={16} />
              </Pressable>
            </View>

            <Field label="Bank Name" value={bankForm.bankName} onChangeText={(value) => setBankForm((current) => ({ ...current, bankName: value }))} placeholder="Access Bank" />
            <Field label="Account Name" value={bankForm.accountName} onChangeText={(value) => setBankForm((current) => ({ ...current, accountName: value }))} placeholder="Adewale A." />
            <Field label="Account Number" value={bankForm.accountNumber} onChangeText={(value) => setBankForm((current) => ({ ...current, accountNumber: value.replace(/[^0-9]/g, '').slice(0, 10) }))} placeholder="0123456789" keyboardType="numeric" />

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setBankForm((current) => ({ ...current, isDefault: !current.isDefault }))}
            >
              <View style={[styles.checkbox, bankForm.isDefault && styles.checkboxActive]} />
              <Text style={styles.checkboxText}>Use as default withdrawal account</Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable style={styles.primaryBtn} onPress={handleSaveBankAccount} disabled={actionLoading}>
                <Text style={styles.primaryBtnText}>{actionLoading ? 'Saving...' : 'Save Bank Account'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showFundingModal} transparent animationType="slide" onRequestClose={() => setShowFundingModal(false)}>
        <Pressable style={[styles.modalOverlay, isCompact && { padding: 12 }]} onPress={() => setShowFundingModal(false)}>
          <Pressable style={[styles.modalCard, isCompact && { padding: 18 }]} onPress={() => {}}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Add Funds to RENAX Wallet</Text>
              <Pressable onPress={() => setShowFundingModal(false)} style={styles.iconBtn}>
                <X color="#444" size={16} />
              </Pressable>
            </View>

            <View style={styles.segmentedRow}>
              {[
                { id: 'card', label: 'Card' },
                { id: 'bank_transfer', label: 'Bank Transfer' },
              ].map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setFundSource(option.id as 'card' | 'bank_transfer')}
                  style={[styles.segmentBtn, fundSource === option.id && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, fundSource === option.id && styles.segmentTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <Field label="Amount" value={fundAmount} onChangeText={(value) => setFundAmount(value.replace(/[^0-9]/g, ''))} placeholder="25000" keyboardType="numeric" />

            {fundSource === 'card' ? (
              <View style={styles.choiceGroup}>
                <Text style={styles.fieldLabel}>Choose Saved Card</Text>
                {cardMethods.length === 0 ? (
                  <Text style={styles.emptyText}>Add a card first before using instant wallet top-up.</Text>
                ) : (
                  cardMethods.map((method) => (
                    <Pressable
                      key={method.id}
                      onPress={() => setSelectedMethodId(method.id)}
                      style={[styles.choiceRow, selectedMethodId === method.id && styles.choiceRowActive]}
                    >
                      <Text style={styles.choiceTitle}>{method.label}</Text>
                      <Text style={styles.choiceSub}>{formatMethodDetail(method)}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            ) : (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  A bank-transfer top-up request will generate a funding reference and keep the transaction pending until finance confirms receipt.
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.primaryBtn} onPress={handleFundWallet} disabled={actionLoading}>
                <Text style={styles.primaryBtnText}>{actionLoading ? 'Processing...' : 'Continue'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showWithdrawalModal} transparent animationType="slide" onRequestClose={() => setShowWithdrawalModal(false)}>
        <Pressable style={[styles.modalOverlay, isCompact && { padding: 12 }]} onPress={() => setShowWithdrawalModal(false)}>
          <Pressable style={[styles.modalCard, isCompact && { padding: 18 }]} onPress={() => {}}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Withdraw Wallet Balance</Text>
              <Pressable onPress={() => setShowWithdrawalModal(false)} style={styles.iconBtn}>
                <X color="#444" size={16} />
              </Pressable>
            </View>

            <Field label="Amount" value={withdrawAmount} onChangeText={(value) => setWithdrawAmount(value.replace(/[^0-9]/g, ''))} placeholder="10000" keyboardType="numeric" />

            <View style={styles.choiceGroup}>
              <Text style={styles.fieldLabel}>Choose Bank Account</Text>
              {bankAccounts.length === 0 ? (
                <Text style={styles.emptyText}>Add a withdrawal bank account first.</Text>
              ) : (
                bankAccounts.map((account) => (
                  <Pressable
                    key={account.id}
                    onPress={() => setSelectedBankAccountId(account.id)}
                    style={[styles.choiceRow, selectedBankAccountId === account.id && styles.choiceRowActive]}
                  >
                    <Text style={styles.choiceTitle}>{account.bank_name}</Text>
                    <Text style={styles.choiceSub}>{account.account_name} •••• {account.account_number_last4}</Text>
                  </Pressable>
                ))
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.primaryBtn} onPress={handleWithdraw} disabled={actionLoading}>
                <Text style={styles.primaryBtnText}>{actionLoading ? 'Submitting...' : 'Request Withdrawal'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  pageTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 26, color: '#111', marginBottom: 24 },
  flashBanner: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  flashText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#166534' },
  centerState: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerStateText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#777', textAlign: 'center' },
  errorText: { fontFamily: 'Outfit_6', fontSize: 14, color: '#B91C1C', textAlign: 'center' },
  walletHero: {
    backgroundColor: '#004d3d',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  walletHeroLeft: { marginBottom: 20 },
  walletBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ccfd3a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  walletBadgeText: { fontFamily: 'Outfit_7', fontSize: 12, color: '#002B22' },
  walletBalanceLabel: { fontFamily: 'Outfit_4', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  walletBalance: { fontFamily: 'PlusJakartaSans_7', fontSize: 34, color: '#fff', marginBottom: 8 },
  walletHint: { fontFamily: 'Outfit_4', fontSize: 13, color: 'rgba(255,255,255,0.72)', maxWidth: 520 },
  walletHeroStats: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginBottom: 20 },
  walletStatCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
  },
  walletStatLabel: { fontFamily: 'Outfit_4', fontSize: 12, color: 'rgba(255,255,255,0.62)', marginBottom: 6 },
  walletStatValue: { fontFamily: 'PlusJakartaSans_6', fontSize: 18, color: '#fff' },
  walletActions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ccfd3a',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minWidth: 150,
  },
  primaryBtnText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#002B22' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ccfd3a',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minWidth: 150,
  },
  secondaryBtnText: { fontFamily: 'Outfit_7', fontSize: 14, color: '#ccfd3a' },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
  },
  sectionTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#111', marginBottom: 4 },
  sectionSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#777', maxWidth: 620 },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f2f7f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallActionText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#004d3d' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  methodCard: {
    width: '48%',
    minWidth: 280,
    borderWidth: 1,
    borderColor: '#eef1ef',
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#fbfcfb',
  },
  methodHead: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  methodIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodName: { fontFamily: 'PlusJakartaSans_6', fontSize: 16, color: '#111', marginBottom: 4 },
  methodSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#666' },
  methodMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  methodMeta: { fontFamily: 'Outfit_6', fontSize: 12, color: '#777' },
  defaultPill: {
    backgroundColor: '#ecfccb',
    color: '#365314',
    fontFamily: 'Outfit_7',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  methodActions: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionPillText: { fontFamily: 'Outfit_6', fontSize: 12, color: '#004d3d' },
  bankList: { gap: 14 },
  bankCard: {
    borderWidth: 1,
    borderColor: '#eef1ef',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  bankName: { fontFamily: 'PlusJakartaSans_6', fontSize: 15, color: '#111', marginBottom: 4 },
  bankSub: { fontFamily: 'Outfit_4', fontSize: 13, color: '#666' },
  emptyText: { fontFamily: 'Outfit_4', fontSize: 14, color: '#777' },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f2',
  },
  transactionTitle: { fontFamily: 'Outfit_6', fontSize: 14, color: '#111', marginBottom: 4 },
  transactionSub: { fontFamily: 'Outfit_4', fontSize: 12, color: '#777' },
  transactionAmount: { fontFamily: 'PlusJakartaSans_6', fontSize: 15, color: '#111', marginBottom: 4 },
  transactionStatus: { fontFamily: 'Outfit_7', fontSize: 11, letterSpacing: 0.4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: { fontFamily: 'PlusJakartaSans_7', fontSize: 20, color: '#111' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f4f5',
  },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontFamily: 'Outfit_6', fontSize: 12, color: '#555', marginBottom: 8, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: 'Outfit_4',
    fontSize: 14,
    color: '#111',
    backgroundColor: '#fafafa',
  },
  inlineFields: { flexDirection: 'row', gap: 12 },
  segmentedRow: { flexDirection: 'row', gap: 10, marginBottom: 18, flexWrap: 'wrap' },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  segmentBtnActive: { backgroundColor: '#004d3d', borderColor: '#004d3d' },
  segmentText: { fontFamily: 'Outfit_6', fontSize: 13, color: '#444' },
  segmentTextActive: { color: '#fff' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    backgroundColor: '#fff',
  },
  checkboxActive: { backgroundColor: '#004d3d', borderColor: '#004d3d' },
  checkboxText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#444' },
  modalActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
  choiceGroup: { marginTop: 6, marginBottom: 10 },
  choiceRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  choiceRowActive: { borderColor: '#004d3d', backgroundColor: '#f0fdf4' },
  choiceTitle: { fontFamily: 'Outfit_6', fontSize: 14, color: '#111', marginBottom: 4 },
  choiceSub: { fontFamily: 'Outfit_4', fontSize: 12, color: '#666' },
  infoBox: {
    marginTop: 8,
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  infoText: { fontFamily: 'Outfit_4', fontSize: 13, color: '#92400e' },
});
