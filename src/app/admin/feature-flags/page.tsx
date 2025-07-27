'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface FeatureFlag {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetedUserIds: string[];
  targetedRoles: string[];
  environmentOverrides: {
    development?: boolean;
    staging?: boolean;
    production?: boolean;
  };
  created_at: string;
  updated_at: string;
  created_by: string;
}

export default function FeatureFlagsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || session.user.role !== 'admin') {
      router.push('/');
    }
  }, [session, status, router]);

  // Load feature flags
  const loadFlags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/feature-flags');
      if (!response.ok) throw new Error('Failed to load feature flags');
      const data = await response.json();
      setFlags(data.flags);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load feature flags',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  // Create a new feature flag
  const createFlag = async () => {
    const name = prompt('Enter feature flag name (e.g., FEATURE_NEW_DASHBOARD):');
    if (!name) return;

    try {
      setSaving(true);
      const response = await fetch('/api/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: '',
          enabled: false,
          rolloutPercentage: 0,
          targetedUserIds: [],
          targetedRoles: [],
          environmentOverrides: {}
        })
      });

      if (!response.ok) throw new Error('Failed to create feature flag');
      
      const data = await response.json();
      setFlags([...flags, data.flag]);
      setSelectedFlag(data.flag);
      
      toast({
        title: 'Success',
        description: 'Feature flag created successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create feature flag',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Update a feature flag
  const updateFlag = async (flag: FeatureFlag) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/feature-flags/${flag.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: flag.description,
          enabled: flag.enabled,
          rolloutPercentage: flag.rolloutPercentage,
          targetedUserIds: flag.targetedUserIds,
          targetedRoles: flag.targetedRoles,
          environmentOverrides: flag.environmentOverrides
        })
      });

      if (!response.ok) throw new Error('Failed to update feature flag');
      
      const data = await response.json();
      setFlags(flags.map(f => f.id === data.flag.id ? data.flag : f));
      setSelectedFlag(data.flag);
      
      toast({
        title: 'Success',
        description: 'Feature flag updated successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update feature flag',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete a feature flag
  const deleteFlag = async (flag: FeatureFlag) => {
    if (!confirm(`Are you sure you want to delete ${flag.name}?`)) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/feature-flags/${flag.name}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete feature flag');
      
      setFlags(flags.filter(f => f.id !== flag.id));
      if (selectedFlag?.id === flag.id) {
        setSelectedFlag(null);
      }
      
      toast({
        title: 'Success',
        description: 'Feature flag deleted successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete feature flag',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Feature Flags Management</h1>
        <div className="flex gap-2">
          <Button onClick={loadFlags} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={createFlag} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Flag
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Flag List */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {flags.map(flag => (
                  <button
                    key={flag.id}
                    onClick={() => setSelectedFlag(flag)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedFlag?.id === flag.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">{flag.name}</div>
                        {flag.description && (
                          <div className="text-xs opacity-70 mt-1">
                            {flag.description}
                          </div>
                        )}
                      </div>
                      <Badge variant={flag.enabled ? 'default' : 'secondary'}>
                        {flag.enabled ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Flag Details */}
        <div className="md:col-span-2">
          {selectedFlag ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{selectedFlag.name}</CardTitle>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteFlag(selectedFlag)}
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="general">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="targeting">Targeting</TabsTrigger>
                    <TabsTrigger value="environments">Environments</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4">
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={selectedFlag.description || ''}
                        onChange={(e) => setSelectedFlag({
                          ...selectedFlag,
                          description: e.target.value
                        })}
                        placeholder="Describe what this feature flag controls..."
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="enabled">Enabled</Label>
                      <Switch
                        id="enabled"
                        checked={selectedFlag.enabled}
                        onCheckedChange={(checked) => setSelectedFlag({
                          ...selectedFlag,
                          enabled: checked
                        })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="rollout">
                        Rollout Percentage: {selectedFlag.rolloutPercentage}%
                      </Label>
                      <Slider
                        id="rollout"
                        value={[selectedFlag.rolloutPercentage]}
                        onValueChange={([value]) => setSelectedFlag({
                          ...selectedFlag,
                          rolloutPercentage: value
                        })}
                        max={100}
                        step={5}
                        className="mt-2"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="targeting" className="space-y-4">
                    <div>
                      <Label htmlFor="userIds">Targeted User IDs</Label>
                      <Textarea
                        id="userIds"
                        value={selectedFlag.targetedUserIds.join('\n')}
                        onChange={(e) => setSelectedFlag({
                          ...selectedFlag,
                          targetedUserIds: e.target.value
                            .split('\n')
                            .filter(id => id.trim())
                        })}
                        placeholder="One user ID per line..."
                        rows={4}
                      />
                    </div>

                    <div>
                      <Label htmlFor="roles">Targeted Roles</Label>
                      <div className="flex gap-2 mt-2">
                        {['admin', 'manager', 'warehouse_staff', 'customer'].map(role => (
                          <label key={role} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedFlag.targetedRoles.includes(role)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFlag({
                                    ...selectedFlag,
                                    targetedRoles: [...selectedFlag.targetedRoles, role]
                                  });
                                } else {
                                  setSelectedFlag({
                                    ...selectedFlag,
                                    targetedRoles: selectedFlag.targetedRoles.filter(r => r !== role)
                                  });
                                }
                              }}
                            />
                            <span className="text-sm">{role}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="environments" className="space-y-4">
                    {['development', 'staging', 'production'].map(env => (
                      <div key={env} className="flex items-center justify-between">
                        <Label htmlFor={env} className="capitalize">{env}</Label>
                        <Switch
                          id={env}
                          checked={selectedFlag.environmentOverrides[env as keyof typeof selectedFlag.environmentOverrides] ?? selectedFlag.enabled}
                          onCheckedChange={(checked) => setSelectedFlag({
                            ...selectedFlag,
                            environmentOverrides: {
                              ...selectedFlag.environmentOverrides,
                              [env]: checked
                            }
                          })}
                        />
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>

                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => updateFlag(selectedFlag)}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>

                <div className="mt-4 text-xs text-muted-foreground">
                  <div>Created: {new Date(selectedFlag.created_at).toLocaleString()}</div>
                  <div>Updated: {new Date(selectedFlag.updated_at).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96 text-muted-foreground">
                Select a feature flag to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}